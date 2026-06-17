import { parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'
import { isGeminiEnabled } from '@/lib/ai/config.server'
import { mockAIResponse } from '@/lib/ai/prompts'
import type { CodeTemplate } from '@/lib/codeTemplates'
import { normalizeCodeTemplate } from '@/lib/codeTemplates'
import { defaultPathForCodeTemplate } from '@/lib/design/cmsExportPaths'
import { streamCodeFromDesign } from '@/lib/design/generateDesign'
import { assertSelectedPages } from '@/lib/design/buildConvertBundle'
import { resolveDesignPages } from '@/lib/design/pages'
import {
  defaultConvertPrompt,
  mergeCodeTemplateConvertOutput,
  nextScaffoldFallback,
  shouldUseNextScaffoldFallback,
} from '@/lib/design/codeTemplateConvert'
import {
  buildSiteManifest,
  persistSiteManifest,
  SITE_MANIFEST_PATH,
  parseSiteManifest,
} from '@/lib/design/siteManifest'
import { DESIGN_SPEC_JSON, hasAppSourceFiles } from '@/lib/design/types'
import { deployProjectToVercel } from '@/lib/integrations/vercelDeploy'
import type { UserIntegrationRow } from '@/lib/integrations/types'
import {
  generateBackendFromManifest,
  mergeGeneratedWithExisting,
} from '@/lib/publish/backendGenerator'
import { filterDeployableFiles } from '@/lib/publish/filterDeployFiles'
import { validateProjectForWebDeploy } from '@/lib/mobile/validateDeploy'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'

export type PublishPhase =
  | 'analyze'
  | 'convert'
  | 'backend'
  | 'validate'
  | 'deploy'
  | 'done'
  | 'error'

export type PublishEvent =
  | { phase: PublishPhase; message?: string }
  | { phase: 'done'; url: string; deploymentId: string }
  | { phase: 'error'; message: string }

type PublishStore = {
  list: () => Promise<ProjectFileRecord[]>
  putMany: (
    files: Array<{ path: string; content: string; language?: string }>,
  ) => Promise<void>
}

function convertPhaseLabel(codeTemplate: CodeTemplate): string {
  if (codeTemplate === 'html') return 'Convirtiendo diseño a HTML estático…'
  return `Convirtiendo diseño a ${codeTemplate}…`
}

export async function runPublishPipeline(params: {
  store: PublishStore
  integration: UserIntegrationRow
  projectName: string
  framework?: string
  codeTemplate?: CodeTemplate
  modelId?: string
  existingVercelProjectId?: string | null
  postgresUrl?: string | null
  resendApiKey?: string | null
  contactToEmail?: string | null
  onEvent: (event: PublishEvent) => void
}): Promise<{ url: string; deploymentId: string; vercelProjectId: string }> {
  const emit = params.onEvent
  const framework = params.framework ?? 'next'
  const codeTemplate = normalizeCodeTemplate(params.codeTemplate)

  try {
    emit({ phase: 'analyze', message: 'Analizando capacidades del sitio…' })
    let designFiles = await params.store.list()
    const siteType =
      parseSiteManifest(designFiles.find((f) => f.path === SITE_MANIFEST_PATH)?.content)?.siteType
    let manifest = await persistSiteManifest(params.store, designFiles, siteType, {
      inferLinksIfMissing: true,
      modelId: params.modelId,
    })
    designFiles = await params.store.list()

    const paths = designFiles.map((f) => f.path)
    const needsConvert = !hasAppSourceFiles(paths)

    if (needsConvert) {
      emit({ phase: 'convert', message: convertPhaseLabel(codeTemplate) })
      const specRaw = designFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
      const allPages = resolveDesignPages(designFiles, specRaw)
      const selectedPageIds = allPages
        .filter((p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem')
        .map((p) => p.id)
      assertSelectedPages(designFiles, selectedPageIds)

      const convertPrompt = defaultConvertPrompt(codeTemplate)

      let fullText = ''
      if (!isGeminiEnabled()) {
        fullText = mockAIResponse({ command: '/build', prompt: convertPrompt })
      } else {
        fullText = await streamCodeFromDesign({
          prompt: convertPrompt,
          framework,
          projectName: params.projectName,
          designFiles,
          selectedPageIds,
          modelId: params.modelId,
          codeTemplate,
          onToken: () => {},
        })
      }

      const ops = parseFileOperationsFromStream(fullText, {
        defaultPath: defaultPathForCodeTemplate(codeTemplate),
        existingPaths: designFiles.map((f) => f.path),
      })
      const generatedFromAi = ops
        .filter(
          (o): o is Extract<(typeof ops)[number], { type: 'create' | 'update' }> =>
            o.type !== 'delete' && !o.path.startsWith('design/'),
        )
        .map((o) => ({ path: o.path, content: o.content }))

      let toWrite = mergeCodeTemplateConvertOutput({
        codeTemplate,
        projectName: params.projectName,
        framework,
        designFiles,
        selectedPageIds,
        generatedFromAi,
      })

      if (shouldUseNextScaffoldFallback(codeTemplate, toWrite)) {
        toWrite = [...nextScaffoldFallback(params.projectName), ...toWrite]
      }

      if (toWrite.length) {
        await params.store.putMany(
          toWrite.map((f) => ({
            path: f.path,
            content: f.content,
            language: f.path.endsWith('.json')
              ? 'json'
              : f.path.match(/\.(tsx|ts|jsx|js)$/)
                ? 'typescript'
                : undefined,
          })),
        )
      }
      designFiles = await params.store.list()
    }

    const pathsAfter = designFiles.map((f) => f.path)
    const hasNextApp =
      pathsAfter.includes('app/page.tsx') ||
      pathsAfter.includes('app/layout.tsx') ||
      pathsAfter.some((p) => p.startsWith('app/') && p.endsWith('/page.tsx'))
    manifest =
      parseSiteManifest(designFiles.find((f) => f.path === SITE_MANIFEST_PATH)?.content) ??
      manifest

    if (hasNextApp && codeTemplate === 'html' && (manifest?.forms?.length ?? 0) > 0) {
      emit({ phase: 'backend', message: 'Generando API y esquema de base de datos…' })
      const manifestForBackend = manifest ?? buildSiteManifest({ designFiles })
      const backendFiles = generateBackendFromManifest(manifestForBackend)
      const existingDeployable = designFiles
        .filter((f) => !f.path.startsWith('design/') && f.path !== 'spec/design.md')
        .map((f) => ({ path: f.path, content: f.content }))
      const merged = mergeGeneratedWithExisting(existingDeployable, backendFiles)
      await params.store.putMany(
        merged.map((f) => ({
          path: f.path,
          content: f.content,
          language: f.path.endsWith('.json') ? 'json' : undefined,
        })),
      )
      designFiles = await params.store.list()
    } else if (codeTemplate !== 'html') {
      emit({
        phase: 'backend',
        message: 'Omitiendo API Next — usa export/ para instalar en tu CMS',
      })
    }

    emit({ phase: 'validate', message: 'Validando proyecto…' })
    const allFiles = designFiles.map((f) => ({ path: f.path, content: f.content }))
    const deployFiles = filterDeployableFiles(allFiles, codeTemplate)
    const manifestForValidation =
      parseSiteManifest(deployFiles.find((f) => f.path === SITE_MANIFEST_PATH)?.content) ?? manifest
    const validation = validateProjectForWebDeploy(deployFiles, {
      codeTemplate,
      manifest: manifestForValidation,
    })
    if (!validation.ok) {
      const msg = validation.issues
        .filter((i) => i.severity === 'error')
        .map((i) => i.message)
        .join('; ')
      throw new Error(msg || 'Validación de deploy fallida')
    }

    emit({ phase: 'deploy', message: 'Desplegando preview en Vercel…' })
    const envVariables: Array<{ key: string; value: string }> = []
    if (params.postgresUrl?.trim()) {
      envVariables.push({ key: 'POSTGRES_URL', value: params.postgresUrl.trim() })
    }
    if (params.resendApiKey?.trim()) {
      envVariables.push({ key: 'RESEND_API_KEY', value: params.resendApiKey.trim() })
    }
    if (params.contactToEmail?.trim()) {
      envVariables.push({ key: 'CONTACT_TO_EMAIL', value: params.contactToEmail.trim() })
    }

    const { deploymentUrl, deploymentId, projectId } = await deployProjectToVercel({
      integration: params.integration,
      projectName: params.projectName,
      files: deployFiles,
      existingProjectId: params.existingVercelProjectId,
      target: 'production',
      envVariables,
    })

    emit({ phase: 'done', url: deploymentUrl, deploymentId })
    return { url: deploymentUrl, deploymentId, vercelProjectId: projectId }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al publicar'
    emit({ phase: 'error', message })
    throw e
  }
}

export async function ensureSiteManifestOnDesignComplete(
  store: PublishStore,
  designFiles: ProjectFileRecord[],
): Promise<void> {
  await persistSiteManifest(store, designFiles)
}

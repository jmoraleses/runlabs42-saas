import 'server-only'

import type { CodeTemplate } from '@/lib/codeTemplates'
import { mergeCodeTemplateConvertOutput } from '@/lib/design/codeTemplateConvert'
import { resolveDesignPages } from '@/lib/design/pages'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'
import type { ProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import type { AutoRunSend } from '@/lib/auto/types'

export type StoreTemplateVariant = {
  id: string
  codeTemplate: CodeTemplate
  exportPrefix: string
  fileCount: number
}

export async function buildStoreTemplates(opts: {
  ctx: ProjectFilesContext
  projectName: string
  variantCount: number
  storeTemplates: CodeTemplate[]
  send: AutoRunSend
}): Promise<StoreTemplateVariant[]> {
  const designFiles = await opts.ctx.store.list()
  const specRaw = designFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
  const allPages = resolveDesignPages(designFiles, specRaw)
  const selectedPageIds = allPages
    .filter((p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem')
    .map((p) => p.id)

  const variants: StoreTemplateVariant[] = []
  const templates =
    opts.storeTemplates.length > 0
      ? opts.storeTemplates
      : (['html'] as CodeTemplate[])

  for (let i = 0; i < opts.variantCount; i++) {
    const variantId = `v${i + 1}`
    const codeTemplate = templates[i % templates.length]!
    opts.send({
      phase: 'build-store-templates',
      message: `Plantilla ${codeTemplate} (${variantId})…`,
      progress: `${i + 1}/${opts.variantCount}`,
      variantId,
      codeTemplate,
    })

    const exportPrefix = `export/variants/${variantId}/${codeTemplate}`
    const converted = mergeCodeTemplateConvertOutput({
      codeTemplate,
      projectName: `${opts.projectName} ${variantId}`,
      framework: 'vanilla',
      designFiles,
      selectedPageIds,
      generatedFromAi: [],
    })

    const prefixed = converted.map((f) => ({
      path: f.path.startsWith('export/')
        ? f.path.replace(/^export\//, `${exportPrefix}/`)
        : `spec/store-templates/${variantId}/${f.path}`,
      content: f.content,
    }))

    prefixed.push({
      path: `spec/store-templates/${variantId}/manifest.json`,
      content: JSON.stringify(
        {
          variantId,
          codeTemplate,
          exportPrefix,
          generatedAt: new Date().toISOString(),
          paths: prefixed.map((p) => p.path),
        },
        null,
        2,
      ),
    })

    await opts.ctx.store.putMany(prefixed)
    variants.push({
      id: variantId,
      codeTemplate,
      exportPrefix,
      fileCount: prefixed.length,
    })
  }

  return variants
}

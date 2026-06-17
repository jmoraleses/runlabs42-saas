import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { isGeminiEnabled, resolveDesignGenerateModelId } from '@/lib/ai/config.server'
import { mockAIResponse } from '@/lib/ai/prompts'
import { parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'
import { streamCodeFromDesign } from '@/lib/design/generateDesign'
import { findDesignEntry } from '@/lib/design/previewServe'
import { requireDesignRouteContext, updateProjectDesignMeta } from '@/lib/design/requireDesignRoute'
import { assertSelectedPages } from '@/lib/design/buildConvertBundle'
import { resolveDesignPages } from '@/lib/design/pages'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'
import {
  resolveProjectCodeTemplate,
  resolveProjectCodeTemplateLinkParamMap,
} from '@/lib/design/resolveProjectCodeTemplate'
import { defaultPathForCodeTemplate } from '@/lib/design/cmsExportPaths'
import {
  defaultConvertPrompt,
  mergeCodeTemplateConvertOutput,
  nextScaffoldFallback,
  shouldUseNextScaffoldFallback,
} from '@/lib/design/codeTemplateConvert'
import { persistSiteManifest } from '@/lib/design/siteManifest'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-convert'), 6, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const ctx = await requireDesignRouteContext(projectId)
    const codeTemplate = await resolveProjectCodeTemplate(ctx, projectId, body.codeTemplate)
    const codeTemplateLinkParamMap = await resolveProjectCodeTemplateLinkParamMap(ctx, projectId)
    const prompt = String(body.prompt ?? defaultConvertPrompt(codeTemplate)).trim()
    const framework = String(body.framework ?? 'react')
    const projectName = String(body.projectName ?? 'Proyecto')
    const model = body.model ? resolveDesignGenerateModelId(String(body.model)) : undefined

    const designFiles = await ctx.store.list()
    if (!findDesignEntry(designFiles)) {
      throw new ApiError(400, 'No hay diseño para convertir')
    }

    const specRaw = designFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const allPages = resolveDesignPages(designFiles, specRaw)
    let selectedPageIds = Array.isArray(body.selectedPageIds)
      ? body.selectedPageIds.map((x: unknown) => String(x))
      : []
    if (!selectedPageIds.length) {
      selectedPageIds = allPages
        .filter((p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem')
        .map((p) => p.id)
    }
    assertSelectedPages(designFiles, selectedPageIds)

    const encoder = new TextEncoder()
    const useGemini = isGeminiEnabled()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: string) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`),
          )
        }
        try {
          let fullText = ''
          if (!useGemini) {
            fullText = mockAIResponse({ command: '/build', prompt })
            const words = fullText.split(/(\s+)/)
            for (const chunk of words) {
              send('token', chunk)
              await new Promise((r) => setTimeout(r, 8))
            }
          } else {
            fullText = await streamCodeFromDesign({
              prompt,
              framework,
              projectName,
              designFiles,
              selectedPageIds,
              modelId: model,
              codeTemplate,
              onToken: (chunk) => send('token', chunk),
            })
          }

          const existingPaths = designFiles.map((f) => f.path)
          const ops = parseFileOperationsFromStream(fullText, {
            defaultPath: defaultPathForCodeTemplate(codeTemplate),
            existingPaths,
          })
          const generatedFromAi = ops
            .filter(
              (o): o is Extract<(typeof ops)[number], { type: 'create' | 'update' }> =>
                o.type !== 'delete' && !o.path.startsWith('design/'),
            )
            .map((o) => ({ path: o.path, content: o.content }))

          let toWrite = mergeCodeTemplateConvertOutput({
            codeTemplate,
            projectName,
            framework,
            designFiles,
            selectedPageIds,
            generatedFromAi,
            codeTemplateLinkParamMap,
          })

          if (shouldUseNextScaffoldFallback(codeTemplate, toWrite)) {
            toWrite = [...nextScaffoldFallback(projectName), ...toWrite]
          }

          if (toWrite.length) {
            await ctx.store.putMany(toWrite)
          }

          const updatedFiles = await ctx.store.list()
          await persistSiteManifest(ctx.store, updatedFiles)

          await updateProjectDesignMeta(ctx, projectId, {
            designPhase: 'code',
            designApprovedAt: new Date().toISOString(),
            codeTemplate,
          })

          send('files', JSON.stringify(toWrite))
          send('done', '')
        } catch (e) {
          send('error', e instanceof Error ? e.message : 'Error al convertir')
          send('done', '')
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}

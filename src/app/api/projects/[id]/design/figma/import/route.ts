import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { put } from '@vercel/blob'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import {
  getDesignGenModelId,
  isGeminiEnabled,
  resolveDesignGenerateModelId,
} from '@/lib/ai/config.server'
import { resolveVertexAgentTextModelId } from '@/lib/ai/vertexModelAllowlist'
import { generateDesignFromPrompt } from '@/lib/design/generateDesign'
import { figmaSummaryForPrompt, simplifyFigmaTree } from '@/lib/design/figmaToDesignPrompt'
import { parseDesignSpecJson } from '@/lib/design/mergeDesignSpec'
import { requireDesignRouteContext, updateProjectDesignMeta } from '@/lib/design/requireDesignRoute'
import { resolveDesignPages } from '@/lib/design/pages'
import { withVertexDesignSpec } from '@/lib/design/vertexSpec'
import { parseDesignDevice } from '@/lib/design/breakpoints'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'
import { fetchFigmaFile, parseFigmaFileKey } from '@/lib/integrations/figmaApi'
import { getFigmaAccessToken } from '@/lib/integrations/figmaOAuth'
import { figmaImportBlobPath } from '@/lib/storage/blobPaths'
import { blobToken, isBlobStorageEnabled } from '@/lib/storage/config'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'figma-import'), 10, 60 * 60_000)
    if (!rl.ok) throw new ApiError(429, 'Límite de importaciones Figma alcanzado')

    const body = await request.json()
    const fileUrl = String(body.fileUrl ?? body.url ?? '').trim()
    const extraPrompt = String(body.prompt ?? '').trim()
    const projectName = String(body.projectName ?? 'Proyecto').trim()
    const framework = String(body.framework ?? 'react').trim()
    const model = body.model ? resolveDesignGenerateModelId(String(body.model)) : undefined
    const device = parseDesignDevice(body.device)
    const stream = body.stream === true

    const fileKey = parseFigmaFileKey(fileUrl)
    if (!fileKey) throw new ApiError(400, 'URL de Figma inválida')

    const supabase = await createClient()
    const token = await getFigmaAccessToken(supabase, user.id)
    if (!token) {
      throw new ApiError(403, 'Conecta tu cuenta de Figma en Ajustes → Integraciones')
    }

    const figmaFile = await fetchFigmaFile(token, fileKey)
    const screens = simplifyFigmaTree(figmaFile.document)
    const prompt = figmaSummaryForPrompt(figmaFile.name ?? 'Figma', screens, extraPrompt)

    const importId = `fig-${Date.now()}`
    if (isBlobStorageEnabled()) {
      const pathname = figmaImportBlobPath(user.id, projectId, importId)
      await put(pathname, JSON.stringify({ fileKey, screens }), {
        access: 'public',
        token: blobToken(),
        contentType: 'application/json',
        addRandomSuffix: false,
      })
    }

    const ctx = await requireDesignRouteContext(projectId)
    const existing = await ctx.store.list()
    const useGemini = isGeminiEnabled()

    if (stream) {
      const encoder = new TextEncoder()
      const responseStream = new ReadableStream({
        async start(controller) {
          const send = (type: string, data: string) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`),
            )
          }
          try {
            if (!useGemini) {
              send('error', 'Vertex AI no configurado')
              send('done', '')
              return
            }
            const { files } = await generateDesignFromPrompt(prompt, {
              existing,
              projectName,
              framework,
              modelId:
                model ??
                resolveVertexAgentTextModelId(
                  process.env.DESIGN_FIGMA_MODEL?.trim(),
                  getDesignGenModelId(),
                ),
              device,
              fromFigma: true,
              onToken: (chunk) => send('token', chunk),
              send,
            })
            const vertexFiles = withVertexDesignSpec(files).map((f) => {
              if (f.path !== DESIGN_SPEC_JSON) return f
              const spec = parseDesignSpecJson(f.content) ?? {
                version: 2 as const,
                title: figmaFile.name ?? 'Figma',
                summary: '',
                tokens: {},
              }
              return {
                path: f.path,
                content: JSON.stringify(
                  {
                    ...spec,
                    source: 'figma' as const,
                    figmaImport: {
                      fileKey,
                      fileName: figmaFile.name,
                      importedAt: new Date().toISOString(),
                    },
                  },
                  null,
                  2,
                ),
              }
            })

            await ctx.store.putMany(
              vertexFiles.map((f) => ({
                path: f.path,
                content: f.content,
                kind: f.path.endsWith('.html') ? ('html' as const) : ('json' as const),
              })),
            )
            await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })
            const specRaw = vertexFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
            const pages = resolveDesignPages(vertexFiles, specRaw)
            send('files', JSON.stringify({ paths: vertexFiles.map((f) => f.path), pages }))
            send('done', '')
          } catch (e) {
            send('error', e instanceof Error ? e.message : 'Error al importar desde Figma')
            send('done', '')
          } finally {
            controller.close()
          }
        },
      })
      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    if (!useGemini) {
      throw new ApiError(503, 'Vertex AI no está configurado')
    }

    const { files } = await generateDesignFromPrompt(prompt, {
      existing,
      projectName,
      framework,
      modelId:
        model ??
        resolveVertexAgentTextModelId(process.env.DESIGN_FIGMA_MODEL?.trim(), getDesignGenModelId()),
      device,
      fromFigma: true,
    })
    const vertexFiles = withVertexDesignSpec(files).map((f) => {
      if (f.path !== DESIGN_SPEC_JSON) return f
      const spec = parseDesignSpecJson(f.content) ?? {
        version: 2 as const,
        title: figmaFile.name ?? 'Figma',
        summary: '',
        tokens: {},
      }
      return {
        path: f.path,
        content: JSON.stringify(
          {
            ...spec,
            source: 'figma' as const,
            figmaImport: {
              fileKey,
              fileName: figmaFile.name,
              importedAt: new Date().toISOString(),
            },
          },
          null,
          2,
        ),
      }
    })

    await ctx.store.putMany(
      vertexFiles.map((f) => ({
        path: f.path,
        content: f.content,
        kind: f.path.endsWith('.html') ? ('html' as const) : ('json' as const),
      })),
    )
    await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })
    const specRaw = vertexFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const pages = resolveDesignPages(vertexFiles, specRaw)

    return NextResponse.json({
      ok: true,
      paths: vertexFiles.map((f) => f.path),
      pages,
      importId,
    })
  } catch (e) {
    return jsonError(e)
  }
}

import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { isGeminiEnabled, resolveDesignGenerateModelId } from '@/lib/ai/config.server'
import { regenerateOrchestrationFromTokens } from '@/lib/design/orchestration'
import { designCanvasPathsFromSpec, parseDesignSpec, resolveDesignPages } from '@/lib/design/pages'
import { requireDesignRouteContext, updateProjectDesignMeta } from '@/lib/design/requireDesignRoute'
import { parseDesignDevice } from '@/lib/design/breakpoints'
import { parseDesignBriefFromBody } from '@/lib/design/designBrief'
import {
  buildOrchestrationCanvasPages,
} from '@/lib/design/orchestrationCanvas'
import {
  DESIGN_LAYOUT_PATH,
  DESIGN_TOKENS_PATH,
  parseLayoutPages,
} from '@/lib/design/orchestrationParse'
import { resolveDesignImagesFromBody } from '@/lib/design/resolveDesignImages'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'
import { isRequestAborted } from '@/lib/server/benignSocketErrors'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-regenerate-tokens'), 6, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    if (!isGeminiEnabled()) {
      throw new ApiError(503, 'Vertex AI no está configurado.')
    }

    const body = await request.json()
    const prompt = String(body.prompt ?? '').trim()
    if (!prompt) throw new ApiError(400, 'El prompt es obligatorio')
    const model = body.model ? resolveDesignGenerateModelId(String(body.model)) : undefined
    const device = parseDesignDevice(body.device)
    const images = await resolveDesignImagesFromBody(body as Record<string, unknown>)
    const brief = parseDesignBriefFromBody(body as Record<string, unknown>, prompt)
    const stream = body.stream === true

    const ctx = await requireDesignRouteContext(projectId)
    const existingFiles = await ctx.store.list()
    const tokensJson =
      existingFiles.find((f) => f.path === DESIGN_TOKENS_PATH)?.content ??
      (typeof body.tokensJson === 'string' ? body.tokensJson : null)
    if (!tokensJson?.trim()) {
      throw new ApiError(400, 'No hay tokens de diseño guardados')
    }

    if (stream) {
      const encoder = new TextEncoder()
      const responseStream = new ReadableStream({
        async start(controller) {
          let streamOpen = true
          const send = (type: string, data: string) => {
            if (!streamOpen || request.signal.aborted) return
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`),
              )
            } catch {
              streamOpen = false
            }
          }
          const closeStream = () => {
            if (!streamOpen) return
            streamOpen = false
            try {
              controller.close()
            } catch {
              /* ya cerrado */
            }
          }
          request.signal.addEventListener('abort', closeStream, { once: true })

          const accumulated = new Map<string, string>()

          const persistPartial = async (batch: Array<{ path: string; content: string }>) => {
            if (!batch.length) return
            for (const f of batch) accumulated.set(f.path, f.content)
            await ctx.store.putMany(
              batch.map((f) => ({
                path: f.path,
                content: f.content,
                language: f.path.endsWith('.json')
                  ? 'json'
                  : f.path.endsWith('.html')
                    ? 'html'
                    : undefined,
              })),
            )
            await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })
            const specRaw = accumulated.get(DESIGN_SPEC_JSON) ?? null
            const layoutRaw = accumulated.get(DESIGN_LAYOUT_PATH) ?? null
            const paths = [...new Set([...accumulated.keys()])]
            let pages = resolveDesignPages(paths.map((path) => ({ path })), specRaw)
            if (layoutRaw) {
              const canvasPages = buildOrchestrationCanvasPages(
                parseLayoutPages(layoutRaw),
                device,
                tokensJson,
              )
              if (canvasPages.length) pages = canvasPages
            }
            send('files', JSON.stringify({ paths, pages }))
          }

          try {
            if (request.signal.aborted) return

            const { files } = await regenerateOrchestrationFromTokens(prompt, {
              device,
              images: images.length ? images : undefined,
              modelId: model,
              brief,
              tokensJson,
              signal: request.signal,
              onToken: (chunk) => send('token', chunk),
              send,
              persistPartial,
            })

            await ctx.store.putMany(
              files.map((f) => ({
                path: f.path,
                content: f.content,
                language: f.path.endsWith('.json')
                  ? 'json'
                  : f.path.endsWith('.html')
                    ? 'html'
                    : undefined,
              })),
            )
            await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })
            const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
            const pages = resolveDesignPages(files, specRaw)
            send('files', JSON.stringify({ paths: files.map((f) => f.path), pages }))
            send('done', '')
          } catch (e) {
            if (isRequestAborted(request.signal, e)) return
            console.error('[design/regenerate-from-tokens] failed', projectId, e)
            send('error', e instanceof Error ? e.message : 'Error al regenerar diseño')
            send('done', '')
          } finally {
            closeStream()
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

    const { files } = await regenerateOrchestrationFromTokens(prompt, {
      device,
      images: images.length ? images : undefined,
      modelId: model,
      brief,
      tokensJson,
    })

    await ctx.store.putMany(
      files.map((f) => ({
        path: f.path,
        content: f.content,
        language: f.path.endsWith('.json')
          ? 'json'
          : f.path.endsWith('.html')
            ? 'html'
            : undefined,
      })),
    )
    await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })

    const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const spec = parseDesignSpec(specRaw)

    return NextResponse.json({
      ok: true,
      paths: files.map((f) => f.path),
      tokens: spec?.tokens,
    })
  } catch (e) {
    return jsonError(e)
  }
}

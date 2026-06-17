import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { isGeminiEnabled, resolveDesignGenerateModelId } from '@/lib/ai/config.server'
import { mockAIResponse } from '@/lib/ai/prompts'
import { generateDesignFromPrompt } from '@/lib/design/generateDesign'
import { loadExistingPrimaryPages } from '@/lib/design/designExistingContext'
import { persistedDesignCanvasPaths, resolveDesignPages } from '@/lib/design/pages'
import { requireDesignRouteContext, updateProjectDesignMeta } from '@/lib/design/requireDesignRoute'
import { withVertexDesignSpec } from '@/lib/design/vertexSpec'
import { parseDesignDevice } from '@/lib/design/breakpoints'
import { parseDesignBriefFromBody } from '@/lib/design/designBrief'
import {
  resolveOrchestrationStreamPages,
} from '@/lib/design/orchestrationCanvas'
import {
  DESIGN_LAYOUT_PATH,
  DESIGN_TOKENS_PATH,
} from '@/lib/design/orchestrationParse'
import { resolveDesignImagesFromBody } from '@/lib/design/resolveDesignImages'
import {
  designAssetReadyPathsFromExisting,
  designImagePlaceholdersForFiles,
  filterPersistableDesignFiles,
} from '@/lib/design/designAssetPlaceholders'
import { isRasterImagePath } from '@/lib/design/previewBinary'
import { clampMockupSampleCount } from '@/lib/design/mockupSampleCount'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'
import { clearPersistedDesignFiles } from '@/lib/storage/clearPersistedDesignFiles'
import { loadExistingDesignFiles } from '@/lib/storage/loadDesignExistingFiles'
import { isDemoFilesystemBackend } from '@/lib/storage/demoProjectFilesStore'
import {
  isBenignStreamWriteError,
  isRequestAborted,
} from '@/lib/server/benignSocketErrors'
import { promptImpliesVisualReference } from '@/lib/design/designReferenceIntent'
import { persistSiteManifest } from '@/lib/design/siteManifest'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-generate'), 8, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const prompt = String(body.prompt ?? '').trim()
    if (!prompt) throw new ApiError(400, 'El prompt es obligatorio')
    const projectName = String(body.projectName ?? 'Proyecto').trim()
    const framework = String(body.framework ?? 'react').trim()
    const model = body.model ? resolveDesignGenerateModelId(String(body.model)) : undefined
    const device = parseDesignDevice(body.device)
    const images = await resolveDesignImagesFromBody(body as Record<string, unknown>)
    const rawImageCount = Array.isArray(body.images) ? body.images.length : 0
    if (rawImageCount > 0 && images.length === 0) {
      console.warn(
        `[design/generate] ${projectId}: ${rawImageCount} imagen(es) en body sin resolver (data/url)`,
      )
      throw new ApiError(
        400,
        'No se pudieron cargar las imágenes de referencia. Vuelve a adjuntarlas o usa una captura más pequeña (máx. 5 MB).',
      )
    } else if (images.length > 0) {
      console.info(
        `[design/generate] ${projectId}: referencia visual — ${images.length} imagen(es) para Vertex`,
      )
    } else if (rawImageCount === 0) {
      console.info(`[design/generate] ${projectId}: sin imágenes de referencia en el body`)
      if (promptImpliesVisualReference(prompt)) {
        throw new ApiError(
          400,
          'Error al cargar la imagen adjunta.',
        )
      }
    }
    const hasElementContexts = Array.isArray(body.elementContexts)
      ? (body.elementContexts as Array<{ skId: string; tagName: string; text?: string }>).filter(
          (c) => c && typeof c.skId === 'string' && typeof c.tagName === 'string',
        )
      : undefined
    const referencePageIdEarly = String(body.referencePageId ?? '').trim() || undefined
    const rebuildPageIdsEarly = Array.isArray(body.rebuildPageIds)
      ? body.rebuildPageIds.map((x: unknown) => String(x).trim()).filter(Boolean)
      : undefined
    const brief = parseDesignBriefFromBody(body as Record<string, unknown>, prompt)
    const stream = body.stream === true
    const orchestrate = true // Forzamos siempre la nueva orquestación
    const mockupSampleCount = clampMockupSampleCount(body.mockupSampleCount)
    const generateImages = body.generateImages !== false
    const imageModelId =
      typeof body.imageModelId === 'string' && body.imageModelId.trim()
        ? body.imageModelId.trim()
        : undefined
    const referencePageId = referencePageIdEarly
    const elementContexts = hasElementContexts
    const forceNewPageExplicit = body.forceNewPage

    const ctx = await requireDesignRouteContext(projectId)
    const existingBeforeClear = await loadExistingDesignFiles(ctx.store)
    const existingPrimaryPagesEarly = loadExistingPrimaryPages(existingBeforeClear)

    const replaceDesign =
      body.replaceDesign === true ||
      (images.length > 0 &&
        !referencePageIdEarly &&
        !elementContexts?.length &&
        !rebuildPageIdsEarly?.length &&
        existingPrimaryPagesEarly.length === 0 &&
        body.newPageOnly !== true)

    if (replaceDesign) {
      const removed = await clearPersistedDesignFiles(ctx.store)
      const autoFromImage =
        body.replaceDesign !== true && images.length > 0 ? ' (referencia visual)' : ''
      console.info(
        `[design/generate] replaceDesign${autoFromImage}: ${removed} archivo(s) de diseño eliminados; Vertex sin context cache`,
        projectId,
      )
    }
    const existing = replaceDesign ? [] : existingBeforeClear
    const existingPrimaryPages = replaceDesign ? [] : existingPrimaryPagesEarly
    const newPageOnly = body.newPageOnly === true
    const rebuildPageIds = Array.isArray(body.rebuildPageIds)
      ? body.rebuildPageIds.map((x: unknown) => String(x).trim()).filter(Boolean)
      : undefined
    const forceNewPage = replaceDesign
      ? false
      : forceNewPageExplicit === true ||
        newPageOnly ||
        (forceNewPageExplicit !== false &&
          existingPrimaryPages.length > 0 &&
          !rebuildPageIds?.length &&
          !referencePageId &&
          !(elementContexts?.length))
    if (forceNewPage && rebuildPageIds?.length) {
      throw new ApiError(
        400,
        'Usa forceNewPage o rebuildPageIds, no ambos a la vez.',
      )
    }
    const existingCanvasPaths = persistedDesignCanvasPaths(existing.map((f) => f.path))
    const existingAssetReadyPaths = designAssetReadyPathsFromExisting(existing)
    const useGemini = isGeminiEnabled()

    if (stream) {
      const encoder = new TextEncoder()
      const streamCtl = { close: () => {} }
      const responseStream = new ReadableStream({
        async start(controller) {
          let streamOpen = true
          const closeStream = () => {
            if (!streamOpen) return
            streamOpen = false
            try {
              controller.close()
            } catch {
              /* ya cerrado */
            }
          }
          streamCtl.close = closeStream
          const send = (type: string, data: string) => {
            if (!streamOpen || request.signal.aborted) return
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`),
              )
            } catch (enqueueErr) {
              streamOpen = false
              if (!isBenignStreamWriteError(enqueueErr)) {
                console.warn('[design/generate] SSE enqueue', projectId, enqueueErr)
              }
            }
          }
          request.signal.addEventListener('abort', closeStream, { once: true })

          const accumulated = new Map<string, string>()
            const pathsForStream = (_specRaw: string | null, accumulatedPaths: string[]) =>
              persistedDesignCanvasPaths([
                ...existingCanvasPaths,
                ...accumulatedPaths,
              ])

            const streamPages = (
              specRaw: string | null,
              tokensRaw: string | null,
              layoutRaw: string | null,
              pathRefs: Array<{ path: string }>,
            ) =>
              resolveOrchestrationStreamPages({
                specRaw,
                tokensRaw,
                layoutRaw,
                device,
                pathRefs,
                existingPrimaryPages,
              })

            const mergeImagePlaceholdersIntoAccumulated = () => {
              const snapshot = [...accumulated.entries()].map(([path, content]) => ({
                path,
                content,
              }))
              for (const p of designImagePlaceholdersForFiles(
                snapshot,
                existingAssetReadyPaths,
              )) {
                accumulated.set(p.path, p.content)
              }
            }

            const flushAccumulated = async (): Promise<boolean> => {
              if (!accumulated.size) return false
              mergeImagePlaceholdersIntoAccumulated()
              const batch = filterPersistableDesignFiles(
                [...accumulated.entries()].map(([path, content]) => ({
                  path,
                  content,
                })),
              ).map(({ path, content }) => ({
                path,
                content,
                language: path.endsWith('.json')
                  ? 'json'
                  : path.endsWith('.html')
                    ? 'html'
                    : undefined,
              }))
              await ctx.store.putMany(batch)
              await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })
              const specRaw = accumulated.get(DESIGN_SPEC_JSON) ?? null
              const tokensRaw = accumulated.get(DESIGN_TOKENS_PATH) ?? null
              const layoutRaw = accumulated.get(DESIGN_LAYOUT_PATH) ?? null
              const paths = pathsForStream(specRaw, [...accumulated.keys()])
              const pages = streamPages(specRaw, tokensRaw, layoutRaw, paths.map((path) => ({ path })))
              send('files', JSON.stringify({ paths, pages }))
              return true
            }

          if (ctx.mode === 'demo') {
            console.info(
              '[design/generate]',
              projectId,
              'demoFs=',
              isDemoFilesystemBackend(),
              'existing=',
              existing.length,
            )
          }

          try {
            if (request.signal.aborted) return

            let vertexFiles: Array<{ path: string; content: string }>

            const persistPartial = async (batch: Array<{ path: string; content: string }>) => {
              if (!batch.length || request.signal.aborted) return
              const persistable = filterPersistableDesignFiles(batch)
              if (!persistable.length) return
              for (const f of persistable) accumulated.set(f.path, f.content)
              try {
                await ctx.store.putMany(
                  persistable.map((f) => ({
                    path: f.path,
                    content: f.content,
                    language: f.path.endsWith('.json')
                      ? 'json'
                      : f.path.endsWith('.html')
                        ? 'html'
                        : undefined,
                  })),
                )
              } catch (persistErr) {
                console.error('[design/generate] persistPartial failed', projectId, persistErr)
                send(
                  'error',
                  persistErr instanceof Error
                    ? persistErr.message
                    : 'No se pudieron guardar archivos de diseño',
                )
                throw persistErr
              }
              await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })
              const specRaw = accumulated.get(DESIGN_SPEC_JSON) ?? null
              const tokensRaw = accumulated.get(DESIGN_TOKENS_PATH) ?? null
              const layoutRaw = accumulated.get(DESIGN_LAYOUT_PATH) ?? null
              const paths = pathsForStream(specRaw, [...accumulated.keys()])
              const pages = streamPages(
                specRaw,
                tokensRaw,
                layoutRaw,
                paths.map((path) => ({ path })),
              )
              send('files', JSON.stringify({ paths, pages }))
            }

            if (!useGemini) {
              const mock = mockAIResponse({ command: '/build', prompt })
              for (const chunk of mock.split(/(\s+)/)) {
                if (chunk) send('token', chunk)
              }
              vertexFiles = withVertexDesignSpec(
                (await generateDesignFromPrompt(prompt, { existing, device })).files,
              )
            } else {
              const { files } = await generateDesignFromPrompt(prompt, {
                existing,
                projectName,
                framework,
                modelId: model,
                device,
                images: images.length ? images : undefined,
                orchestrate,
                brief,
                forceNewPage,
                replaceDesign,
                rebuildPageIds,
                referencePageId,
                elementContexts: elementContexts?.length ? elementContexts : undefined,
                signal: request.signal,
                onToken: (chunk) => send('token', chunk),
                send,
                persistPartial,
                mockupSampleCount,
                generateImages,
                imageModelId,
              })
              vertexFiles = withVertexDesignSpec(files)
            }

            const imagePlaceholders = designImagePlaceholdersForFiles(
              vertexFiles,
              existingAssetReadyPaths,
            )
            if (imagePlaceholders.length) {
              vertexFiles = [...vertexFiles, ...imagePlaceholders]
            }

            const persistableVertexFiles = filterPersistableDesignFiles(vertexFiles)
            for (const f of persistableVertexFiles) accumulated.set(f.path, f.content)

            await ctx.store.putMany(
              persistableVertexFiles.map((f) => ({
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
            const allForManifest = [
              ...existing.filter((f) => !replaceDesign || f.path === DESIGN_SPEC_JSON),
              ...persistableVertexFiles,
            ]
            try {
              await persistSiteManifest(ctx.store, allForManifest, brief.siteType)
            } catch (manifestErr) {
              console.warn('[design/generate] site manifest', projectId, manifestErr)
            }
            const specRaw =
              persistableVertexFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
            const paths = persistedDesignCanvasPaths([
              ...existingCanvasPaths,
              ...persistableVertexFiles.map((f) => f.path),
            ])
            const pages = resolveDesignPages(
              [
                ...existing.filter((f) => paths.includes(f.path) || f.path === DESIGN_SPEC_JSON),
                ...persistableVertexFiles,
              ],
              specRaw,
            )
            send('files', JSON.stringify({ paths, pages }))
            send('done', '')
          } catch (e) {
            if (isRequestAborted(request.signal, e)) {
              try {
                await flushAccumulated()
              } catch {
                /* cliente desconectado */
              }
              return
            }
            console.error('[design/generate] failed', projectId, e)
            try {
              await flushAccumulated()
            } catch (flushErr) {
              if (!isRequestAborted(request.signal, flushErr)) {
                console.error('[design/generate] flush accumulated failed', projectId, flushErr)
              }
            }
            send('error', e instanceof Error ? e.message : 'Error al generar diseño')
            send('done', '')
          } finally {
            closeStream()
          }
        },
        cancel() {
          streamCtl.close()
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
      throw new ApiError(
        503,
        'Vertex AI no está configurado. Añade GOOGLE_APPLICATION_CREDENTIALS o credenciales GCP.',
      )
    }

    const { files } = await generateDesignFromPrompt(prompt, {
      existing,
      projectName,
      framework,
      modelId: model,
      device,
      images: images.length ? images : undefined,
      orchestrate,
      brief,
      forceNewPage,
      replaceDesign,
      rebuildPageIds,
      referencePageId,
      elementContexts: elementContexts?.length ? elementContexts : undefined,
      mockupSampleCount,
      generateImages,
      imageModelId,
    })
    let vertexFiles = withVertexDesignSpec(files)

    const imagePlaceholders = designImagePlaceholdersForFiles(
      vertexFiles,
      existingAssetReadyPaths,
    )
    if (imagePlaceholders.length) {
      vertexFiles = [...vertexFiles, ...imagePlaceholders]
    }
    const persistableVertexFiles = filterPersistableDesignFiles(vertexFiles)

    await ctx.store.putMany(
      persistableVertexFiles.map((f) => ({
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

    const specRaw = persistableVertexFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const pages = resolveDesignPages(
      [
        ...existing.filter(
          (f) =>
            persistableVertexFiles.some((v) => v.path === f.path) ||
            f.path === DESIGN_SPEC_JSON,
        ),
        ...persistableVertexFiles,
      ],
      specRaw,
    )
    const paths = persistedDesignCanvasPaths([
      ...existingCanvasPaths,
      ...persistableVertexFiles.map((f) => f.path),
    ])

    return NextResponse.json({ ok: true, paths, pages, projectName })
  } catch (e) {
    return jsonError(e)
  }
}

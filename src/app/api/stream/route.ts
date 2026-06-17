import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireUser } from '@/lib/auth/requireUser'
import { DEMO_USER_ID } from '@/lib/auth/demo-server'
import { requireProjectAccess } from '@/lib/projects/access'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { parseCommand } from '@/lib/ai/commandParser'
import { resolveStreamCommand } from '@/lib/ai/resolveStreamCommand'
import { mockAIResponse } from '@/lib/ai/prompts'
import { isGeminiEnabled } from '@/lib/ai/config.server'
import { resolveModelId } from '@/lib/ai/models'
import {
  pickStreamModelForTask,
  resolveStreamModelForRequest,
} from '@/lib/ai/resolveCategoryStreamModel'
import { isMaxModelChoice } from '@/lib/ai/spec-kit/orchestrator'
import { MAX_CHAT_IMAGES } from '@/lib/chat/imageAttachments'
import { resolveImageRefsForModel } from '@/lib/storage/chatImages'
import {
  emptyTokenUsage,
  estimateTokensFromText,
  totalTokens,
  type TokenUsage,
} from '@/lib/billing/tokenCredits'
import {
  assertSufficientCreditsForStream,
  settleStreamCredits,
} from '@/lib/billing/settleStreamCredits'

export const runtime = 'nodejs'

const MOCK_MODEL = 'mock-demo'
const SPECKIT_COMMANDS = new Set(['/build', '/mobile-fix', '/plan', '/spec'])

function isReadableStreamClosedError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code === 'ERR_INVALID_STATE'
  }
  return (
    err instanceof TypeError &&
    /already closed|Invalid state/i.test(err.message)
  )
}

export async function POST(request: Request) {
  try {
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'stream'), 30, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const prompt = String(body.prompt ?? body.message ?? '')
    const rawFiles = Array.isArray(body.files) ? body.files : []
    const workspaceFiles: { path: string; content: string }[] = rawFiles
      .filter((f: unknown) => f && typeof f === 'object' && 'path' in f)
      .map((f: { path: string; content?: string }) => ({
        path: String(f.path),
        content: String(f.content ?? ''),
      }))

    parseCommand(prompt) // side-effect: validates prompt; result unused
    const parsed = resolveStreamCommand({
      prompt,
      projectId: body.projectId ? String(body.projectId) : undefined,
      workspaceFileCount: workspaceFiles.length,
    })

    const useGemini = isGeminiEnabled()
    const modelChoice = String(body.model ?? body.modelId ?? 'auto')
    const rawCategoryModels =
      body.categoryModels && typeof body.categoryModels === 'object'
        ? (body.categoryModels as Record<string, unknown>)
        : null
    const categoryModels = rawCategoryModels
      ? {
          code: String(rawCategoryModels.code ?? rawCategoryModels.text ?? '').trim(),
          image: String(rawCategoryModels.image ?? '').trim(),
        }
      : undefined
    const hasImagesEarly = Boolean(
      (Array.isArray(body.images) && body.images.length) ||
        (Array.isArray(body.imageRefs) && body.imageRefs.length),
    )

    const streamModelResolution = useGemini
      ? resolveStreamModelForRequest({
          modelChoice,
          categoryModels,
          geminiEnabled: true,
          command: parsed.command,
          hasImages: hasImagesEarly,
          inferredBuild: parsed.inferredBuild,
        })
      : {
          modelId: MOCK_MODEL,
          task: 'code' as const,
          resolvedCategories: null,
          usesCategoryRouting: false,
        }

    const modelId = streamModelResolution.modelId

    const projectIdStr = String(body.projectId ?? parsed.projectId ?? '')
    const skipCredits =
      user.id === DEMO_USER_ID ||
      user.id.startsWith('guest-') ||
      projectIdStr.startsWith('demo-')
    const rawImages = Array.isArray(body.images) ? body.images : []
    const rawImageRefs = Array.isArray(body.imageRefs) ? body.imageRefs : []
    const imageCount = Math.max(rawImages.length, rawImageRefs.length)
    const useSpecKit = body.useSpecKit === true
    const useSpecKitPipeline =
      useSpecKit && SPECKIT_COMMANDS.has(parsed.command)

    let supabaseUser: Awaited<ReturnType<typeof requireUser>>['supabase'] | null = null
    if (!skipCredits) {
      try {
        const auth = await requireUser()
        supabaseUser = auth.supabase
        const contextChars =
          workspaceFiles.reduce((s: number, f) => s + f.content.length, 0) +
          String(body.code ?? '').length
        await assertSufficientCreditsForStream({
          supabase: auth.supabase,
          userId: user.id,
          modelId,
          prompt,
          contextChars,
          useSpecKitPipeline,
          imageCount,
        })
      } catch (e) {
        if (e instanceof ApiError && e.status === 402) throw e
        /* guest sin sesión completa */
      }
    }

    let resolvedImages = rawImages
      .filter((x: unknown) => x && typeof x === 'object' && 'mimeType' in x && 'data' in x)
      .map((x: { mimeType: string; data: string }) => ({
        mimeType: String(x.mimeType),
        data: String(x.data).replace(/^data:[^;]+;base64,/, ''),
      }))
      .slice(0, MAX_CHAT_IMAGES)

    const chatSessionId = body.chatSessionId ? String(body.chatSessionId) : ''
    const projectIdForChat = projectIdStr && !projectIdStr.startsWith('demo-') ? projectIdStr : ''

    if (projectIdForChat && !skipCredits) {
      const auth = await requireUser()
      await requireProjectAccess(auth.supabase, projectIdForChat, user.id)
    }

    if (chatSessionId && rawImageRefs.length) {
      resolvedImages = await resolveImageRefsForModel(
        rawImageRefs
          .filter((x: unknown) => x && typeof x === 'object' && 'url' in x)
          .map((x: { url: string; mimeType?: string }) => ({
            url: String(x.url),
            mimeType: x.mimeType,
          }))
          .slice(0, MAX_CHAT_IMAGES),
        user.id,
        chatSessionId,
        projectIdForChat || undefined,
      )
    }

    const validThinkingLevels = ['minimal', 'medium', 'high'] as const
    type TLevel = typeof validThinkingLevels[number]
    const rawThinking = String(body.thinkingLevel ?? '')
    const thinkingLevel: TLevel | undefined = (validThinkingLevels as readonly string[]).includes(rawThinking)
      ? (rawThinking as TLevel)
      : undefined

    const targetPlatforms = Array.isArray(body.targetPlatforms)
      ? body.targetPlatforms.map(String)
      : undefined

    let chatHistory = Array.isArray(body.chatHistory)
      ? body.chatHistory
          .filter((m: unknown) => m && typeof m === 'object' && 'role' in m && 'content' in m)
          .map((m: { role: string; content: string }) => ({
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: String(m.content ?? ''),
          }))
      : []

    let memoryBlock = ''
    if (projectIdStr.startsWith('demo-') && process.env.NODE_ENV === 'development') {
      try {
        const { buildLocalMemoryContextBlock } = await import('@/lib/studio/localMemoryStore')
        memoryBlock = await buildLocalMemoryContextBlock(projectIdStr)
      } catch (e) {
        console.warn('[/api/stream] local memory block skipped:', e)
      }
    } else if (projectIdForChat && chatSessionId && !skipCredits) {
      try {
        const auth = await requireUser()
        const { loadChatHistoryForPrompt } = await import('@/lib/chat/chatMessageStore')
        const { buildMemoryContextBlock } = await import('@/lib/ai/memoryContext')
        const serverHistory = await loadChatHistoryForPrompt(
          auth.supabase,
          user.id,
          projectIdForChat,
          chatSessionId,
        )
        if (serverHistory.length) chatHistory = serverHistory
        memoryBlock = await buildMemoryContextBlock(auth.supabase, user.id, projectIdForChat)
      } catch {
        /* fallback al historial del cliente */
      }
    }

    const streamContext = {
      projectId: body.projectId ?? parsed.projectId,
      projectName: body.projectName ? String(body.projectName) : undefined,
      framework: body.framework ? String(body.framework) : undefined,
      targetPlatforms,
      activePath: body.activePath ? String(body.activePath) : undefined,
      code: body.code ? String(body.code) : undefined,
      files: workspaceFiles,
      images: resolvedImages,
      useSpecKit,
      thinkingLevel,
      chatHistory,
      memoryBlock,
      resolvedCategoryModels: streamModelResolution.resolvedCategories ?? undefined,
    }

    const encoder = new TextEncoder()
    const streamState = { closed: false }

    const stream = new ReadableStream({
      async start(controller) {
        const safeClose = () => {
          if (streamState.closed) return
          streamState.closed = true
          try {
            controller.close()
          } catch {
            /* ya cerrado por el runtime o el cliente */
          }
        }

        const send = (type: string, data: string) => {
          if (streamState.closed) return
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`),
            )
          } catch (err) {
            if (isReadableStreamClosedError(err)) {
              streamState.closed = true
              return
            }
            throw err
          }
        }

        const onAbort = () => {
          streamState.closed = true
        }
        request.signal.addEventListener('abort', onAbort)

        try {
          let tokenUsage: TokenUsage = emptyTokenUsage()
          let billedModelId = modelId

          if (useGemini) {
            try {
              const { buildChatInsight } = await import('@/lib/ai/chatInsight.server')
              const insight = await buildChatInsight({
                prompt: parsed.prompt || prompt,
                framework: streamContext.framework,
                command: parsed.command,
                targetPlatforms: streamContext.targetPlatforms,
                workspaceFileCount: workspaceFiles.length,
                projectName: streamContext.projectName,
              })
              send('chat_insight', JSON.stringify(insight))
            } catch (insightErr) {
              console.warn('[/api/stream] chat_insight skipped:', insightErr)
            }

            const orchestratorPrompt = parsed.prompt || prompt
            const orchestratorOpts = {
              userPrompt: orchestratorPrompt,
              defaultModelId: modelId,
              geminiEnabled: useGemini,
              implementModelOverride: streamModelResolution.resolvedCategories?.code,
            }

            if (useSpecKitPipeline) {
              const { runSpecKitPipeline } = await import('@/lib/ai/spec-kit/pipeline')
              const { artifactsFromFiles } = await import('@/lib/ai/spec-kit/artifacts')
              const { planModelsForPipeline } = await import('@/lib/ai/spec-kit/orchestrator')
              const initialArtifacts = artifactsFromFiles(workspaceFiles, '')
              const modelPlan = isMaxModelChoice(modelChoice)
                ? await planModelsForPipeline(orchestratorOpts)
                : undefined
              const result = await runSpecKitPipeline({
                userPrompt: parsed.prompt || prompt,
                projectName: streamContext.projectName,
                framework: streamContext.framework,
                files: streamContext.files,
                images: resolvedImages,
                send,
                modelId,
                modelPlan,
                initialArtifacts,
                streamCommand: parsed.command,
                memoryBlock: streamContext.memoryBlock,
                chatHistory: streamContext.chatHistory,
                targetPlatforms: streamContext.targetPlatforms,
                thinkingLevel: streamContext.thinkingLevel,
              })
              if (result.fileUpdates.length) {
                send('files', JSON.stringify(result.fileUpdates))
              }
              if (result.imageUpdates.length) {
                send('images', JSON.stringify(result.imageUpdates))
              }
              tokenUsage = result.usage
            } else {
              const { streamGeminiAgent } = await import('@/lib/ai/geminiStream')
              const { planModelsForPipeline } = await import('@/lib/ai/spec-kit/orchestrator')
              let streamModelId = modelId
              if (isMaxModelChoice(modelChoice)) {
                if (streamModelResolution.ocrThenCode && streamModelResolution.resolvedCategories) {
                  streamModelId = streamModelResolution.resolvedCategories.code
                } else if (
                  streamModelResolution.usesCategoryRouting &&
                  resolvedImages.length > 0 &&
                  streamModelResolution.resolvedCategories
                ) {
                  streamModelId = pickStreamModelForTask(
                    'ocr',
                    streamModelResolution.resolvedCategories,
                    modelId,
                  )
                } else {
                  streamModelId = (await planModelsForPipeline(orchestratorOpts)).implement
                }
              }
              const out = await streamGeminiAgent(parsed, streamContext, send, streamModelId)
              billedModelId = out.model
              tokenUsage = out.usage
            }

            if (totalTokens(tokenUsage) === 0) {
              const contextText =
                prompt +
                workspaceFiles.map((f) => f.content).join('') +
                String(streamContext.code ?? '')
              tokenUsage = {
                inputTokens: estimateTokensFromText(contextText),
                outputTokens: 512,
              }
            }

            const cost = await settleStreamCredits({
              supabase: supabaseUser,
              userId: user.id,
              skipCredits,
              modelId: billedModelId,
              modelChoice,
              usage: tokenUsage,
              imageCount,
              command: parsed.command,
              provider: 'gemini',
              description: `Gemini ${parsed.command}`,
            })
            send('cost', JSON.stringify(cost))
          } else if (process.env.AI_PROVIDER?.trim().toLowerCase() !== 'mock') {
            send(
              'error',
              'Vertex AI no configurado. Añade GOOGLE_APPLICATION_CREDENTIALS o GOOGLE_CLOUD_* en .env.local y reinicia el servidor.',
            )
          } else {
            const text = mockAIResponse(parsed)
            const words = text.split(/(\s+)/)
            for (const chunk of words) {
              send('token', chunk)
              await new Promise((r) => setTimeout(r, 12))
            }
            {
              const { parseFileOperationsFromStream } = await import('@/lib/ai/parseAssistantOutput')
              const ops = parseFileOperationsFromStream(text, {
                defaultPath: streamContext.activePath ?? 'src/App.tsx',
                existingPaths: streamContext.files.map((f: { path: string }) => f.path),
              })
              const files = ops
                .filter((o) => o.type !== 'delete')
                .map((o) => ({ path: o.path, content: o.content }))
              if (files.length) send('files', JSON.stringify(files))
            }
            const cost = await settleStreamCredits({
              supabase: supabaseUser,
              userId: user.id,
              skipCredits,
              modelId: MOCK_MODEL,
              modelChoice,
              usage: emptyTokenUsage(),
              imageCount,
              command: parsed.command,
              provider: 'mock',
              description: `Mock ${parsed.command}`,
            })
            send('cost', JSON.stringify({ ...cost, credits: 0, billableCredits: 0 }))
          }
          send('done', '')
        } catch (e) {
          if (!isReadableStreamClosedError(e)) {
            console.error('[/api/stream] error:', e)
          }
          const msg = e instanceof Error ? e.message : 'Error en el stream'
          send('error', msg)
          send('done', '')
        } finally {
          request.signal.removeEventListener('abort', onAbort)
          safeClose()
        }
      },
      cancel() {
        streamState.closed = true
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

export { dynamic } from '@/lib/api/routeSegment'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { isGeminiEnabled } from '@/lib/ai/config.server'
import { resolveModelId } from '@/lib/ai/models'
import { runSpecKitPipeline } from '@/lib/ai/spec-kit/pipeline'
import { streamGeminiAgent, type GeminiImagePart } from '@/lib/ai/geminiStream'
import { mockAIResponse } from '@/lib/ai/prompts'
import { getScaffold } from '@/lib/scaffolds'
import { DEMO_USER_ID } from '@/lib/auth/demo-server'
import { requireUser } from '@/lib/auth/requireUser'
import { requireProjectAccess } from '@/lib/projects/access'
import { requireProjectFilesStore } from '@/lib/storage/requireProjectFilesStore'
import { resolveImageRefsForModel } from '@/lib/storage/chatImages'
import { SPEC_KIT_PATHS } from '@/lib/ai/spec-kit/artifacts'
import { MAX_CHAT_IMAGES } from '@/lib/chat/imageAttachments'

type Params = { params: Promise<{ id: string }> }

function parseLegacyImages(raw: unknown): GeminiImagePart[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x) => x && typeof x === 'object' && 'mimeType' in x && 'data' in x)
    .map((x) => ({
      mimeType: String((x as { mimeType: string }).mimeType),
      data: String((x as { data: string }).data).replace(/^data:[^;]+;base64,/, ''),
    }))
    .slice(0, MAX_CHAT_IMAGES)
}

async function resolveImages(
  body: Record<string, unknown>,
  userId: string,
): Promise<GeminiImagePart[]> {
  const sessionId = body.chatSessionId ? String(body.chatSessionId) : ''
  const refs = Array.isArray(body.imageRefs) ? body.imageRefs : []
  if (sessionId && refs.length) {
    const resolved = await resolveImageRefsForModel(
      refs
        .filter((x) => x && typeof x === 'object' && 'url' in x)
        .map((x) => ({
          url: String((x as { url: string }).url),
          mimeType: (x as { mimeType?: string }).mimeType,
        }))
        .slice(0, MAX_CHAT_IMAGES),
      userId,
      sessionId,
    )
    return resolved
  }
  return parseLegacyImages(body.images)
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { user } = await requireStreamUser()
    const { id: projectId } = await params
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'project-generate'), 10, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const prompt = String(body.prompt ?? '').trim()
    if (!prompt) throw new ApiError(400, 'El prompt es obligatorio')

    const useSpecKit = body.useSpecKit === true
    const framework = String(body.framework ?? 'next')
    const projectName = String(body.projectName ?? 'Proyecto')
    const images = await resolveImages(body as Record<string, unknown>, user.id)
    const isDemo = projectId.startsWith('demo-') || user.id === DEMO_USER_ID

    const useGemini = isGeminiEnabled()
    if (!useGemini && !isDemo) {
      throw new ApiError(503, 'Vertex AI no configurado')
    }

    const modelId = resolveModelId(String(body.model ?? 'auto'), { geminiEnabled: useGemini })

    let files = isDemo ? [] : getScaffold(framework, projectName)
    let specContent = `# Spec\n\n${prompt}\n`

    if (!isDemo) {
      const { supabase, user: authUser } = await requireUser()
      await requireProjectAccess(supabase, projectId, authUser.id)
      const store = requireProjectFilesStore(supabase, authUser.id, projectId)
      const existing = await store.list()
      if (existing.length) {
        files = existing.map((f) => ({ path: f.path, content: f.content }))
      }
      const { data: specRow } = await supabase
        .from('specs')
        .select('content')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (specRow?.content) specContent = String(specRow.content)
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: string) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`),
          )
        }

        try {
          if (!useGemini) {
            const text = mockAIResponse({ command: '/build', prompt })
            const words = text.split(/(\s+)/)
            for (const chunk of words) {
              send('token', chunk)
              await new Promise((r) => setTimeout(r, 12))
            }
            const { parseFileOperationsFromStream } = await import('@/lib/ai/parseAssistantOutput')
            const ops = parseFileOperationsFromStream(text, {
              defaultPath: 'src/App.tsx',
              existingPaths: files.map((f) => f.path),
            })
            const out = ops
              .filter((o) => o.type !== 'delete')
              .map((o) => ({ path: o.path, content: o.content }))
            if (out.length) send('files', JSON.stringify(out))
          } else if (useSpecKit) {
            const result = await runSpecKitPipeline({
              userPrompt: prompt,
              projectName,
              framework,
              files,
              images,
              send,
              modelId,
              initialArtifacts: { spec: specContent },
            })

            const generated = result.fileUpdates
            send('token', result.lastText)

            if (!isDemo) {
              const { supabase, user: authUser } = await requireUser()
              await requireProjectAccess(supabase, projectId, authUser.id)
              const store = requireProjectFilesStore(supabase, authUser.id, projectId)
              await store.putMany(
                generated.map((f) => ({ path: f.path, content: f.content })),
              )

              await supabase.from('specs').insert({
                project_id: projectId,
                content: result.specContent,
                created_by: authUser.id,
              })
            }

            send(
              'files',
              JSON.stringify([
                ...generated,
                { path: SPEC_KIT_PATHS.constitution, content: result.artifacts.constitution },
                { path: SPEC_KIT_PATHS.plan, content: result.artifacts.plan },
                { path: SPEC_KIT_PATHS.tasks, content: result.artifacts.tasks },
              ].filter((f) => f.content?.trim())),
            )
          } else {
            const { fullText } = await streamGeminiAgent(
              { command: '/build', prompt },
              { projectName, framework, files, images, useSpecKit: false },
              send,
              modelId,
            )
            const { parseFileOperationsFromStream } = await import('@/lib/ai/parseAssistantOutput')
            const ops = parseFileOperationsFromStream(fullText, {
              defaultPath: 'src/App.tsx',
              existingPaths: files.map((f) => f.path),
            })
            const out = ops
              .filter((o) => o.type !== 'delete')
              .map((o) => ({ path: o.path, content: o.content }))
            if (out.length) send('files', JSON.stringify(out))
          }
          send('done', '')
        } catch (e) {
          send('error', e instanceof Error ? e.message : 'Error al generar')
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

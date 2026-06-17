import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { isGeminiEnabled, resolveDesignGenerateModelId } from '@/lib/ai/config.server'
import { parseDesignDevice } from '@/lib/design/breakpoints'
import { runDesignSpecKitPlan } from '@/lib/design/runDesignPlan'
import { requireDesignRouteContext, updateProjectDesignMeta } from '@/lib/design/requireDesignRoute'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-plan'), 4, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    if (!isGeminiEnabled()) {
      throw new ApiError(
        503,
        'Vertex AI no está configurado. Añade GOOGLE_APPLICATION_CREDENTIALS o credenciales GCP.',
      )
    }

    const body = await request.json()
    const prompt = String(body.prompt ?? '').trim()
    if (!prompt) throw new ApiError(400, 'El prompt es obligatorio')
    const projectName = String(body.projectName ?? 'Proyecto').trim()
    const framework = String(body.framework ?? 'react').trim()
    const modelId = resolveDesignGenerateModelId(String(body.model ?? 'auto'))
    const device = parseDesignDevice(body.device)

    const ctx = await requireDesignRouteContext(projectId)
    const existing = await ctx.store.list()

    const result = await runDesignSpecKitPlan({
      userPrompt: prompt,
      projectName,
      framework,
      files: existing,
      modelId,
      device,
    })

    if (result.fileUpdates.length) {
      await ctx.store.putMany(
        result.fileUpdates.map((f) => ({
          path: f.path,
          content: f.content,
          kind: f.path.endsWith('.json') ? ('json' as const) : ('md' as const),
        })),
      )
    }

    await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })

    return NextResponse.json({
      ok: true,
      paths: result.fileUpdates.map((f) => f.path),
      designPlan: result.designPlan,
      hasSpecKit: Boolean(
        result.artifacts.spec || result.artifacts.plan || result.artifacts.tasks,
      ),
    })
  } catch (e) {
    return jsonError(e)
  }
}

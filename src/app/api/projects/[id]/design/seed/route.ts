import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireDesignRouteContext, updateProjectDesignMeta } from '@/lib/design/requireDesignRoute'
import { applyWebStudioStudioSeed } from '@/lib/design/seeds/webStudioSeed'

type Params = { params: Promise<{ id: string }> }

/** Importa la semilla HTML local del repo (Vertex / Web Studio). */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-seed'), 20, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json().catch(() => ({}))
    const html = body.html ? String(body.html) : undefined

    const ctx = await requireDesignRouteContext(projectId)
    const result = await applyWebStudioStudioSeed(ctx, projectId, html)
    await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })

    return NextResponse.json({
      ok: true,
      source: result.source,
      pages: result.pages,
      paths: result.paths,
    })
  } catch (e) {
    return jsonError(e)
  }
}

import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { mergePagesIntoSpec, parseDesignSpec, resolveDesignPages } from '@/lib/design/pages'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'
import type { PrototypeLink } from '@/lib/design/types'
import { requireDesignRouteContext } from '@/lib/design/requireDesignRoute'
import { mergePrototypeLinks } from '@/lib/design/prototypePages'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    await requireStreamUser()
    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const spec = parseDesignSpec(specRaw)
    const pages = resolveDesignPages(files, specRaw)
    const links = mergePrototypeLinks(spec, pages)
    return NextResponse.json({ ok: true, links, pages })
  } catch (e) {
    return jsonError(e)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-links'), 40, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const links = body.links as PrototypeLink[] | undefined
    if (!Array.isArray(links)) throw new ApiError(400, 'links debe ser un array')

    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const spec = parseDesignSpec(specRaw) ?? {
      version: 2 as const,
      title: 'Proyecto',
      summary: '',
      tokens: {},
    }
    const pages = resolveDesignPages(files, specRaw)
    const specContent = mergePagesIntoSpec(
      { ...spec, prototypeLinks: links },
      pages,
      spec.title,
    )
    await ctx.store.put(DESIGN_SPEC_JSON, specContent)
    return NextResponse.json({ ok: true, links })
  } catch (e) {
    return jsonError(e)
  }
}

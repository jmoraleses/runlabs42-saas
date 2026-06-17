import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import {
  autoLayoutPages,
  blankPageHtml,
  mergePagesIntoSpec,
  nextPageId,
  pageHtmlPath,
  parseDesignSpec,
  resolveDesignPages,
} from '@/lib/design/pages'
import { DESIGN_BREAKPOINT_PRESETS, parseDesignDevice } from '@/lib/design/breakpoints'
import {
  designSpecPageId,
  DESIGN_SITE_INDEX,
  DESIGN_SPEC_JSON,
  isMockupCompanionCanvasPage,
  type DesignPageMeta,
} from '@/lib/design/types'
import { requireDesignRouteContext } from '@/lib/design/requireDesignRoute'

type Params = { params: Promise<{ id: string }> }

/** Páginas que se persisten en spec/design.json (sin marcos --mockup del lienzo). */
function canonicalSpecPages(pages: DesignPageMeta[]): DesignPageMeta[] {
  return pages.filter(
    (p) =>
      !isMockupCompanionCanvasPage(p) &&
      !/-alt-\d+$/.test(p.id) &&
      p.frameType !== 'prototype' &&
      p.frameType !== 'designSystem',
  )
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-pages'), 30, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json().catch(() => ({}))
    const name = String(body.name ?? 'Nueva página').trim() || 'Nueva página'

    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const spec = parseDesignSpec(specRaw)
    const device = parseDesignDevice(spec?.targetDevice ?? 'desktop')
    const { width, height } = DESIGN_BREAKPOINT_PRESETS[device]
    const existing = resolveDesignPages(files, specRaw)
    const id = nextPageId(existing)
    const path = pageHtmlPath(id)
    if (files.some((f) => f.path === path)) throw new ApiError(409, 'La página ya existe')

    const pages = autoLayoutPages([
      ...existing,
      {
        id,
        name,
        path,
        width,
        height,
      },
    ])
    const specContent = mergePagesIntoSpec(spec, pages, name)

    await ctx.store.putMany([
      { path, content: blankPageHtml(name) },
      { path: DESIGN_SPEC_JSON, content: specContent },
    ])

    return NextResponse.json({ ok: true, pageId: id, path, pages })
  } catch (e) {
    return jsonError(e)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-pages-patch'), 40, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const pageId = designSpecPageId(String(body.pageId ?? '').trim())
    if (!pageId) throw new ApiError(400, 'pageId es obligatorio')

    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const canvasPages = resolveDesignPages(files, specRaw)
    const specPages = canonicalSpecPages(canvasPages)
    const idx = specPages.findIndex((p) => p.id === pageId)
    if (idx < 0) throw new ApiError(404, 'Página no encontrada')

    const updated = { ...specPages[idx]! }
    if (body.name != null) updated.name = String(body.name).trim() || updated.name
    if (body.width != null) updated.width = Number(body.width) || updated.width
    if (body.height != null) updated.height = Number(body.height) || updated.height
    if (body.x != null) updated.x = Number(body.x)
    if (body.y != null) updated.y = Number(body.y)

    const positionOnly =
      body.name == null &&
      body.width == null &&
      body.height == null &&
      (body.x != null || body.y != null)
    const nextPages = positionOnly
      ? specPages.map((p, i) => (i === idx ? updated : p))
      : autoLayoutPages(specPages.map((p, i) => (i === idx ? updated : p)))
    const spec = parseDesignSpec(specRaw)
    const specContent = mergePagesIntoSpec(spec, nextPages)

    await ctx.store.put(DESIGN_SPEC_JSON, specContent, 'json')
    return NextResponse.json({ ok: true, pages: nextPages })
  } catch (e) {
    return jsonError(e)
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-pages-delete'), 20, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const url = new URL(request.url)
    const pageId = designSpecPageId(url.searchParams.get('pageId')?.trim() ?? '')
    if (!pageId) throw new ApiError(400, 'pageId query es obligatorio')
    if (pageId === '__design_system__' || pageId === '__prototype__') {
      throw new ApiError(400, 'No se puede eliminar el marco de Visual Language')
    }

    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const specPages = canonicalSpecPages(resolveDesignPages(files, specRaw))
    if (specPages.length <= 1) throw new ApiError(400, 'Debe quedar al menos una página')

    const target = specPages.find((p) => p.id === pageId)
    if (!target) throw new ApiError(404, 'Página no encontrada')

    const path = target.path || pageHtmlPath(pageId)
    const remaining = autoLayoutPages(specPages.filter((p) => p.id !== pageId))
    const spec = parseDesignSpec(specRaw)
    const specContent = mergePagesIntoSpec(spec, remaining)

    if (path !== DESIGN_SITE_INDEX || remaining.length === 0) {
      await ctx.store.delete(path)
    }
    const cssPath = path.replace(/index\.html$/, 'styles.css')
    if (files.some((f) => f.path === cssPath)) await ctx.store.delete(cssPath)
    await ctx.store.put(DESIGN_SPEC_JSON, specContent, 'json')

    return NextResponse.json({ ok: true, pages: remaining })
  } catch (e) {
    return jsonError(e)
  }
}

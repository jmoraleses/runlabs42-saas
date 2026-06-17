import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { pageHtmlPath } from '@/lib/design/pages'
import { DESIGN_SITE_INDEX } from '@/lib/design/types'
import { requireDesignRouteContext } from '@/lib/design/requireDesignRoute'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    await requireStreamUser()
    const body = await request.json()
    const variantId = String(body.variantId ?? '').trim()
    const pageId = body.pageId ? String(body.pageId) : null
    if (!variantId || variantId.includes('..')) throw new ApiError(400, 'variantId inválido')

    const ctx = await requireDesignRouteContext(projectId)
    const variantPath = `design/variants/${variantId}/index.html`
    const variant = await ctx.store.get(variantPath)
    if (!variant) throw new ApiError(404, 'Variante no encontrada')

    const cssVariant = await ctx.store.get(`design/variants/${variantId}/styles.css`)
    const target = pageId ? pageHtmlPath(pageId) : DESIGN_SITE_INDEX
    await ctx.store.put(target, variant.content, 'html')
    if (cssVariant) {
      const cssTarget = target.replace(/index\.html$/, 'styles.css')
      await ctx.store.put(cssTarget, cssVariant.content, 'css')
    }

    return NextResponse.json({ ok: true, pageId: pageId ?? 'home', path: target })
  } catch (e) {
    return jsonError(e)
  }
}

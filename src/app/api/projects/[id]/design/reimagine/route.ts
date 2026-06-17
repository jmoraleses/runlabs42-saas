import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { isGeminiEnabled } from '@/lib/ai/config.server'
import { reimagineDesignVariants } from '@/lib/design/generateDesign'
import { pageHtmlPath, pageMockupPath, parseDesignSpec } from '@/lib/design/pages'
import { findDesignEntry } from '@/lib/design/previewServe'
import { requireDesignRouteContext } from '@/lib/design/requireDesignRoute'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-reimagine'), 8, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    if (!isGeminiEnabled()) {
      throw new ApiError(503, 'Vertex AI no está configurado.')
    }

    const body = await request.json()
    const prompt = String(body.prompt ?? '').trim()
    if (!prompt) throw new ApiError(400, 'El prompt es obligatorio')

    const pageId = body.pageId ? String(body.pageId) : null
    const elementContext = body.elementContext as
      | { skId: string; tagName: string; text?: string }
      | undefined

    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const spec = parseDesignSpec(specRaw)

    let pagePath = findDesignEntry(files)
    let pageMeta = spec?.pages?.[0]
    if (pageId) {
      pageMeta = spec?.pages?.find((p) => p.id === pageId)
      pagePath =
        pageMeta?.path ??
        (pageMeta?.media === 'image' ? pageMockupPath(pageId) : pageHtmlPath(pageId))
    }
    if (!pagePath) throw new ApiError(404, 'Sin mockup de diseño')

    const file = await ctx.store.get(pagePath)
    if (!file) throw new ApiError(404, 'Archivo de diseño no encontrado')

    const isImagePage = pageMeta?.media === 'image' || pagePath.endsWith('.png')

    const variants = await reimagineDesignVariants(
      prompt,
      isImagePage ? '' : file.content,
      specRaw ?? undefined,
      elementContext,
      { pageMeta, pngBase64: isImagePage ? file.content : undefined },
    )

    await ctx.store.putMany(
      variants.map((v) => ({
        path: v.path,
        content: v.content,
        kind: v.path.endsWith('.html') ? ('html' as const) : undefined,
      })),
    )

    return NextResponse.json({
      ok: true,
      variants: variants.map((v) => ({ path: v.path })),
    })
  } catch (e) {
    return jsonError(e)
  }
}

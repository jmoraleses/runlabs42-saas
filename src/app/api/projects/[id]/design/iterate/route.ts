import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { isGeminiEnabled } from '@/lib/ai/config.server'
import { iterateDesignPage } from '@/lib/design/generateDesign'
import { pageHtmlPath, parseDesignSpec } from '@/lib/design/pages'
import { requireDesignRouteContext } from '@/lib/design/requireDesignRoute'
import { parseDesignDevice } from '@/lib/design/breakpoints'
import {
  inferDesignBriefFromPrompt,
  mergeDesignBrief,
  parseDesignBriefFromBody,
} from '@/lib/design/designBrief'
import {
  DESIGN_LAYOUT_PATH,
  DESIGN_TOKENS_PATH,
} from '@/lib/design/orchestrationParse'
import { resolveDesignImagesFromBody } from '@/lib/design/resolveDesignImages'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-iterate'), 12, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    if (!isGeminiEnabled()) {
      throw new ApiError(503, 'Vertex AI no está configurado.')
    }

    const body = await request.json()
    const prompt = String(body.prompt ?? '').trim()
    if (!prompt) throw new ApiError(400, 'El prompt es obligatorio')
    const pageId = String(body.pageId ?? '').trim()
    if (!pageId) throw new ApiError(400, 'pageId es obligatorio')

    const elementContext = body.elementContext as
      | { skId: string; tagName: string; text?: string }
      | undefined
    const elementContexts = Array.isArray(body.elementContexts)
      ? (body.elementContexts as Array<{ skId: string; tagName: string; text?: string }>)
      : elementContext
        ? [elementContext]
        : undefined
    const images = await resolveDesignImagesFromBody(body as Record<string, unknown>)
    const device = parseDesignDevice(body.device)
    const brief = mergeDesignBrief(
      parseDesignBriefFromBody(body as Record<string, unknown>, prompt),
      inferDesignBriefFromPrompt(prompt),
    )

    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    const tokensJson = files.find((f) => f.path === DESIGN_TOKENS_PATH)?.content
    const layoutJson = files.find((f) => f.path === DESIGN_LAYOUT_PATH)?.content
    const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const spec = parseDesignSpec(specRaw)
    const pageMeta = spec?.pages?.find((p) => p.id === pageId)
    const htmlPath = pageHtmlPath(pageId)
    const htmlFile = files.find((f) => f.path === htmlPath)
    const pagePath = htmlFile
      ? htmlPath
      : (pageMeta?.path ??
        (pageMeta?.media === 'image' ? `design/mockups/${pageId}.png` : htmlPath))

    const file = htmlFile ?? (await ctx.store.get(pagePath))
    if (!file) throw new ApiError(404, 'Página de diseño no encontrada')

    const isImagePage = !htmlFile && (pageMeta?.media === 'image' || pagePath.endsWith('.png'))

    const updated = await iterateDesignPage({
      prompt,
      pagePath,
      pageId,
      html: isImagePage ? undefined : file.content,
      pngBase64: isImagePage ? file.content : undefined,
      pageMeta,
      spec: spec ?? undefined,
      elementContext: elementContexts?.length === 1 ? elementContexts[0] : undefined,
      elementContexts: elementContexts?.length ? elementContexts : undefined,
      images: images.length ? images : undefined,
      device,
      brief,
      tokensJson,
      layoutJson,
    })

    await ctx.store.put(updated.path, updated.content, isImagePage ? undefined : 'html')
    if (updated.imageFiles?.length) {
      await ctx.store.putMany(
        updated.imageFiles.map((f) => ({ path: f.path, content: f.content })),
      )
    }

    if (updated.updatedImagePrompt && spec) {
      const nextPages = (spec.pages ?? []).map((p) =>
        p.id === pageId ? { ...p, imagePrompt: updated.updatedImagePrompt } : p,
      )
      await ctx.store.put(
        DESIGN_SPEC_JSON,
        JSON.stringify({ ...spec, pages: nextPages }, null, 2),
        'json',
      )
    }

    return NextResponse.json({
      ok: true,
      path: updated.path,
      pageId,
      imagePaths: updated.imageFiles?.map((f) => f.path) ?? [],
    })
  } catch (e) {
    return jsonError(e)
  }
}

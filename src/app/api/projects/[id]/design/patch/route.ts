import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { applyDesignHtmlPatch } from '@/lib/design/applyDesignHtmlPatch'
import { pageHtmlPath } from '@/lib/design/pages'
import { findDesignEntry } from '@/lib/design/previewServe'
import type { VisualPatch } from '@/lib/visual-edit/protocol'
import { requireDesignRouteContext } from '@/lib/design/requireDesignRoute'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    await requireStreamUser()
    const body = await request.json()
    const patch = body.patch as VisualPatch | undefined
    const element = body.element as { skId: string; tagName: string; text?: string } | undefined
    if (!patch?.skId || !patch.property || patch.value == null || !element?.skId) {
      throw new ApiError(400, 'patch y element son obligatorios')
    }

    const pageId = body.pageId ? String(body.pageId) : null
    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    let entry = pageId ? pageHtmlPath(pageId) : findDesignEntry(files)
    if (pageId && !files.some((f) => f.path === entry)) entry = findDesignEntry(files)
    if (!entry) throw new ApiError(404, 'Sin mockup de diseño')

    const file = await ctx.store.get(entry)
    if (!file) throw new ApiError(404, 'Archivo de diseño no encontrado')

    const { html, applied } = applyDesignHtmlPatch(file.content, patch, element, {
      previousText: body.previousText ? String(body.previousText) : undefined,
    })
    if (!applied) throw new ApiError(422, 'No se pudo aplicar el parche')

    await ctx.store.put(entry, html, 'html')
    return NextResponse.json({ ok: true, applied: true })
  } catch (e) {
    return jsonError(e)
  }
}

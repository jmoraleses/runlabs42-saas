import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError } from '@/lib/api/errors'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import { findPreviewEntry, rewriteHtmlForPreview } from '@/lib/mobile/previewServe'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await requireProjectFilesContext(id)
    const files = await ctx.store.list()
    const entry = findPreviewEntry(files)
    if (!entry) {
      return NextResponse.json({ error: 'No hay index.html en el proyecto' }, { status: 404 })
    }
    const file = files.find((f) => f.path === entry)
    if (!file) {
      return NextResponse.json({ error: 'Entrada de preview no encontrada' }, { status: 404 })
    }
    const html = rewriteHtmlForPreview(file.content, id, entry)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; connect-src 'self' https:;",
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}

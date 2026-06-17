import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import { imageBodyFromStoredContent } from '@/lib/design/previewBinary'

type Params = { params: Promise<{ projectId: string; path?: string[] }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireStreamUser()
    const { projectId, path: parts } = await params
    const rel = (parts ?? []).map(decodeURIComponent).join('/')
    if (!rel || rel.includes('..')) throw new ApiError(400, 'Ruta no válida')

    const ctx = await requireProjectFilesContext(projectId)
    const file = await ctx.store.get(rel)
    if (!file) throw new ApiError(404, 'Archivo no encontrado')

    if (rel.endsWith('.json')) {
      return new NextResponse(file.content, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }

    if (rel.endsWith('.zip')) {
      const buf = imageBodyFromStoredContent(file.content) ?? Buffer.from(file.content, 'base64')
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${rel.split('/').pop() ?? 'package.zip'}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const buf = imageBodyFromStoredContent(file.content)
    if (!buf) throw new ApiError(400, 'No es un asset binario')
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': rel.endsWith('.png') ? 'image/png' : 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}

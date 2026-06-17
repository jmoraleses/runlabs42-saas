import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { head } from '@vercel/blob'
import { jsonError, ApiError } from '@/lib/api/errors'
import { verifyFigmaExportToken } from '@/lib/design/figmaExportToken'
import type { FigmaExportBundle } from '@/lib/design/designHtmlToFigma'
import { figmaExportBlobPath } from '@/lib/storage/blobPaths'
import { blobToken, isBlobStorageEnabled } from '@/lib/storage/config'

type Params = { params: Promise<{ id: string; exportId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: projectId, exportId } = await params
    const token = new URL(request.url).searchParams.get('token')?.trim()
    if (!token) throw new ApiError(401, 'Token requerido')

    const verified = verifyFigmaExportToken(token, projectId, exportId)
    if (!verified) throw new ApiError(403, 'Token inválido o expirado')

    if (!isBlobStorageEnabled()) throw new ApiError(503, 'Blob no disponible')

    const pathname = figmaExportBlobPath(verified.userId, projectId, exportId)
    const meta = await head(pathname, { token: blobToken() })
    if (!meta?.url) throw new ApiError(404, 'Exportación no encontrada')

    const res = await fetch(meta.url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new ApiError(404, 'No se pudo leer el bundle')
    const bundle = (await res.json()) as FigmaExportBundle

    return NextResponse.json(bundle)
  } catch (e) {
    return jsonError(e)
  }
}

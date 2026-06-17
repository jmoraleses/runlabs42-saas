import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import { mimeForPath } from '@/lib/mobile/previewServe'
import { DESIGN_PLACEHOLDER_SVG } from '@/lib/design/designPlaceholderAssets'
import { imageBodyFromStoredContent, isRasterImagePath, isSvgImagePath } from '@/lib/design/previewBinary'
import {
  designPlaceholderJpegBuffer,
  rasterPreviewBody,
} from '@/lib/design/previewRasterServe'

type Params = { params: Promise<{ id: string; path?: string[] }> }

function isFontPath(filePath: string): boolean {
  return /\.(woff2?|ttf|otf|eot)$/i.test(filePath)
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id, path: pathParts } = await params
    const rel = decodeURIComponent((pathParts ?? []).join('/'))
    if (!rel || rel.includes('..')) throw new ApiError(400, 'Ruta no válida')

    const filePath =
      rel.startsWith('design/') ? rel : rel.startsWith('design/site/') ? rel : `design/site/${rel}`
    const ctx = await requireProjectFilesContext(id)
    let file = await ctx.store.get(filePath)
    if (!file && isRasterImagePath(filePath)) {
      const buf = designPlaceholderJpegBuffer()
      if (buf.length) {
        return new NextResponse(new Uint8Array(buf), {
          headers: {
            'Content-Type': mimeForPath(filePath),
            'Cache-Control': 'no-store',
          },
        })
      }
    }
    if (!file && isSvgImagePath(filePath)) {
      return new NextResponse(DESIGN_PLACEHOLDER_SVG, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-store',
        },
      })
    }
    if (!file) throw new ApiError(404, 'Archivo no encontrado')

    const mime = mimeForPath(filePath)
    if (isRasterImagePath(filePath)) {
      const buf = await rasterPreviewBody(file.content, filePath)
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'no-store',
        },
      })
    }
    if (isSvgImagePath(filePath)) {
      return new NextResponse(file.content.trim() || DESIGN_PLACEHOLDER_SVG, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-store',
        },
      })
    }
    if (isFontPath(filePath)) {
      const buf = imageBodyFromStoredContent(file.content)
      if (buf?.length) {
        return new NextResponse(new Uint8Array(buf), {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'no-store',
          },
        })
      }
    }

    return new NextResponse(file.content, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}

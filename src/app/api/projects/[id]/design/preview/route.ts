import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError } from '@/lib/api/errors'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import {
  findDesignEntry,
  findDesignMdContent,
  rewriteDesignHtml,
} from '@/lib/design/previewServe'
import { pageHtmlPath, pageMockupPath } from '@/lib/design/pages'
import { isImageMockupPath } from '@/lib/design/types'
import { decodeDesignBinary } from '@/lib/design/previewBinary'
import { designPreviewPlaceholderHtml } from '@/lib/design/designPreviewPlaceholderHtml'
import { isDesignPreviewPlaceholderHtml } from '@/lib/design/isDesignPreviewPlaceholderHtml'
import { isOrchestrationPlaceholderHtml } from '@/lib/design/orchestrationFallbackHtml'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const variant = url.searchParams.get('variant')?.trim()
    const pageId = url.searchParams.get('page')?.trim()
    const cacheKey = url.searchParams.get('k')?.trim()
    const ctx = await requireProjectFilesContext(id)
    const files = await ctx.store.list()
    let entry: string | null = null
    if (pageId && !pageId.includes('..')) {
      const mockupPath = pageMockupPath(pageId)
      const htmlPath = pageHtmlPath(pageId)
      if (files.some((f) => f.path === htmlPath)) entry = htmlPath
      else if (files.some((f) => f.path === mockupPath)) entry = mockupPath
    } else if (variant && !variant.includes('..')) {
      const variantHtml = `design/variants/${variant}/index.html`
      const variantPng = files.find(
        (f) => f.path.startsWith(`design/variants/${variant}/`) && f.path.endsWith('.png'),
      )?.path
      if (files.some((f) => f.path === variantHtml)) entry = variantHtml
      else if (variantPng) entry = variantPng
    } else {
      entry = findDesignEntry(files)
    }
    if (!entry) {
      if (pageId) {
        const html = designPreviewPlaceholderHtml('es')
        return new NextResponse(html, {
          status: 404,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        })
      }
      return NextResponse.json({ error: 'No hay mockup de diseño' }, { status: 404 })
    }
    const file = files.find((f) => f.path === entry)
    if (!file) {
      return NextResponse.json({ error: 'Entrada de diseño no encontrada' }, { status: 404 })
    }

    if (isImageMockupPath(entry)) {
      const { body, mimeType } = decodeDesignBinary(file.content)
      return new NextResponse(new Uint8Array(body), {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'no-store',
        },
      })
    }

    if (
      isOrchestrationPlaceholderHtml(file.content) ||
      isDesignPreviewPlaceholderHtml(file.content)
    ) {
      const html = designPreviewPlaceholderHtml('es')
      return new NextResponse(html, {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }

    const designMd = findDesignMdContent(files)
    const html = rewriteDesignHtml(
      file.content,
      id,
      entry,
      cacheKey ? Number.parseInt(cacheKey, 10) : undefined,
      designMd,
      pageId ?? null,
    )
    // CSP: solo la política global de next.config.mjs (incl. cdn.tailwindcss.com y fonts).
    // No añadir otra Content-Security-Policy aquí: dos políticas se intersectan y bloquean el CDN/fuentes.
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}

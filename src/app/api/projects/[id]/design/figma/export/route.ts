import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { put } from '@vercel/blob'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { getAppUrl } from '@/lib/env'
import { buildFigmaExportBundle } from '@/lib/design/designHtmlToFigma'
import { signFigmaExportToken } from '@/lib/design/figmaExportToken'
import { pageHtmlPath, resolveDesignPages } from '@/lib/design/pages'
import { requireDesignRouteContext } from '@/lib/design/requireDesignRoute'
import { figmaExportBlobPath } from '@/lib/storage/blobPaths'
import { blobToken, isBlobStorageEnabled } from '@/lib/storage/config'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'figma-export'), 20, 60 * 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas exportaciones')

    const body = await request.json().catch(() => ({}))
    const pageIds = Array.isArray(body.pageIds)
      ? (body.pageIds as string[]).map(String)
      : null

    if (!isBlobStorageEnabled()) {
      throw new ApiError(503, 'Almacenamiento Blob requerido para exportar a Figma')
    }

    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    const specRaw = files.find((f) => f.path === 'spec/design.json')?.content ?? null
    const pages = resolveDesignPages(files, specRaw).filter(
      (p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem',
    )
    const targetPages = pageIds?.length
      ? pages.filter((p) => pageIds.includes(p.id))
      : pages

    if (!targetPages.length) throw new ApiError(404, 'No hay páginas de diseño para exportar')

    const htmlPages: Array<{ pageId: string; name: string; html: string }> = []
    for (const page of targetPages) {
      const path = page.path || pageHtmlPath(page.id)
      const file = files.find((f) => f.path === path) ?? (await ctx.store.get(path))
      if (!file?.content) continue
      htmlPages.push({
        pageId: page.id,
        name: page.name.replace(/^☑\s*/, ''),
        html: file.content,
      })
    }

    if (!htmlPages.length) throw new ApiError(404, 'No se encontró HTML de diseño')

    const exportId = `fexp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const bundle = buildFigmaExportBundle(projectId, htmlPages)
    const pathname = figmaExportBlobPath(user.id, projectId, exportId)

    await put(pathname, JSON.stringify(bundle), {
      access: 'public',
      token: blobToken(),
      contentType: 'application/json',
      addRandomSuffix: false,
    })

    const token = signFigmaExportToken(user.id, projectId, exportId)
    const base = getAppUrl().replace(/\/$/, '')
    const downloadUrl = `${base}/api/projects/${projectId}/design/figma/export/${exportId}?token=${encodeURIComponent(token)}`

    return NextResponse.json({
      ok: true,
      exportId,
      token,
      downloadUrl,
      pageCount: htmlPages.length,
      pluginHint: 'Pega el exportId en el plugin Runlabs42 → Importar diseño',
    })
  } catch (e) {
    return jsonError(e)
  }
}

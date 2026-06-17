import { pageHtmlPath, resolveDesignPages } from '@/lib/design/pages'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'

export type StaticPreviewFile = { path: string; content: string }

function toRouteSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Copia HTML del diseño a `preview/` para deploy estático en Vercel. */
export function buildStaticPreviewFromDesign(
  designFiles: ProjectFileRecord[],
  selectedPageIds: string[],
): StaticPreviewFile[] {
  const specRaw = designFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
  const allPages = resolveDesignPages(designFiles, specRaw)
  const selected = new Set(selectedPageIds)
  const pages =
    selected.size > 0
      ? allPages.filter((p) => selected.has(p.id))
      : allPages.filter((p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem')

  const byPath = new Map(designFiles.map((f) => [f.path, f.content]))
  const out: StaticPreviewFile[] = []
  const usedSegments = new Set<string>()

  for (const page of pages) {
    const htmlPath = page.htmlPath ?? pageHtmlPath(page.id)
    const html = byPath.get(htmlPath)?.trim()
    if (!html) continue
    let slug = ''
    if (page.id !== 'home' && page.id !== 'index') {
      const preferred = toRouteSegment(page.name) || toRouteSegment(page.id) || page.id
      slug = preferred
      if (usedSegments.has(slug)) {
        slug = `${preferred}-${toRouteSegment(page.id) || 'page'}`
      }
      usedSegments.add(slug)
    }
    const dest = slug ? `preview/${slug}/index.html` : 'preview/index.html'
    out.push({ path: dest, content: html })
  }

  if (!out.some((f) => f.path === 'preview/index.html')) {
    const site = byPath.get('design/site/index.html')?.trim()
    if (site) out.unshift({ path: 'preview/index.html', content: site })
  }

  if (out.length > 0 && !out.some((f) => f.path === 'preview/404.html')) {
    out.push({
      path: 'preview/404.html',
      content: `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>404</title></head><body><h1>No encontrado</h1><p><a href="/">Inicio</a></p></body></html>`,
    })
  }

  return out
}

import { hasPersistedDesignPageHtml } from '@/lib/design/isDesignPreviewPlaceholderHtml'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'
import { ensureDesignSystemPage, ensurePrototypePage } from '@/lib/design/prototypePages'
import {
  DESIGN_MOCKUPS_PREFIX,
  DESIGN_MOCKUP_CANVAS_SUFFIX,
  DESIGN_PAGES_PREFIX,
  DESIGN_SITE_INDEX,
  isDesignCanvasFilePath,
  isImageMockupPath,
  isMockupCompanionCanvasPage,
  pageMockupPath,
  type DesignPageMeta,
  type DesignSpec,
} from '@/lib/design/types'

/** Mínimo necesario para descubrir páginas; `content` evita tratar la ruta aurora como HTML listo. */
export type DesignPageFileRef = Pick<ProjectFileRecord, 'path'> & {
  content?: string
}

function hasRealHtmlFileInByPath<T extends DesignPageFileRef>(
  byPath: Map<string, T>,
  htmlPath: string,
  pagePath: string,
): boolean {
  const candidates = [htmlPath, pagePath].filter(Boolean)
  for (const candidate of candidates) {
    const file = byPath.get(candidate)
    if (hasPersistedDesignPageHtml(file?.content)) return true
  }
  return false
}

export const DEFAULT_PAGE_WIDTH = 390
export const DEFAULT_PAGE_HEIGHT = 844
export const PAGE_GAP = 64

export function pageHtmlPath(pageId: string): string {
  if (pageId === 'home' || pageId === 'index') {
    return DESIGN_SITE_INDEX
  }
  return `${DESIGN_PAGES_PREFIX}${pageId}/index.html`
}

export { pageMockupPath } from '@/lib/design/types'

export function parsePageIdFromPath(path: string): string | null {
  if (path === DESIGN_SITE_INDEX) return 'home'
  const m = path.match(/^design\/pages\/([^/]+)\/index\.html$/)
  return m?.[1] ?? null
}

/** Página afectada por un archivo persistido en el stream (HTML, PNG o asset). */
export function pageIdForDesignStreamPath(path: string): string | null {
  if (path.endsWith('.html')) return parsePageIdFromPath(path)
  if (path.startsWith(`${DESIGN_PAGES_PREFIX}`) && path.includes('/assets/')) {
    const m = path.match(/^design\/pages\/([^/]+)\/assets\//)
    return m?.[1] ?? null
  }
  if (path.startsWith('design/site/assets/')) return 'home'
  if (isImageMockupPath(path)) {
    const id = path.slice(DESIGN_MOCKUPS_PREFIX.length, -4)
    return id || null
  }
  return null
}

export function pageIdsForDesignStreamPaths(paths: string[]): string[] {
  const ids = new Set<string>()
  for (const p of paths) {
    const id = pageIdForDesignStreamPath(p)
    if (id) ids.add(id)
  }
  return [...ids]
}

export type PagePreviewStamps = Record<string, { html: number; assets: number }>

/** Incrementa stamps de preview por página según archivos del stream (HTML vs asset). */
export function bumpPagePreviewStampsFromPaths(
  prev: PagePreviewStamps,
  paths: string[],
): PagePreviewStamps {
  if (!paths.length) return prev
  let next: PagePreviewStamps | null = null
  for (const path of paths) {
    const pageId = pageIdForDesignStreamPath(path)
    if (!pageId) continue
    const base = next ?? prev
    const cur = base[pageId] ?? { html: 0, assets: 0 }
    if (path.endsWith('.html') || isImageMockupPath(path)) {
      if (!next) next = { ...prev }
      next[pageId] = { ...cur, html: cur.html + 1 }
    } else if (path.includes('/assets/')) {
      if (!next) next = { ...prev }
      next[pageId] = { ...cur, assets: cur.assets + 1 }
    }
  }
  return next ?? prev
}

/** Incrementa el stamp HTML de páginas concretas (invalida preview del iframe en el lienzo). */
export function bumpPagePreviewStampsForPageIds(
  prev: PagePreviewStamps,
  pageIds: string[],
): PagePreviewStamps {
  if (!pageIds.length) return prev
  const next = { ...prev }
  for (const rawId of pageIds) {
    const pageId = parsePageIdFromPath(rawId) ?? rawId
    const cur = next[pageId] ?? { html: 0, assets: 0 }
    next[pageId] = { ...cur, html: cur.html + 1 }
  }
  return next
}

/** Rutas de lienzo inferidas del spec (mockups + HTML) sin listar todo el workspace. */
export function designCanvasPathsFromSpec(designJson: string | null | undefined): string[] {
  const spec = parseDesignSpec(designJson)
  const paths = new Set<string>()
  for (const page of spec?.pages ?? []) {
    if (page.path && isDesignCanvasFilePath(page.path)) paths.add(page.path)
    const mockup = page.mockupPath ?? (page.id ? pageMockupPath(page.id) : null)
    if (mockup && isDesignCanvasFilePath(mockup)) paths.add(mockup)
    const html = pageHtmlPath(page.id)
    if (isDesignCanvasFilePath(html)) paths.add(html)
  }
  return [...paths]
}

/** Rutas de lienzo para SSE: solo archivos ya persistidos (evita htmlReady antes del HTML real). */
export function persistedDesignCanvasPaths(accumulatedPaths: string[]): string[] {
  return accumulatedPaths.filter((p) => isDesignCanvasFilePath(p))
}

export function parseDesignSpec(raw: string | null | undefined): DesignSpec | null {
  if (!raw?.trim()) return null
  try {
    return JSON.parse(raw) as DesignSpec
  } catch {
    return null
  }
}

export function listDesignPageFiles<T extends DesignPageFileRef>(files: T[]): T[] {
  return files.filter((f) => {
    if (f.path === DESIGN_SITE_INDEX) return true
    if (isImageMockupPath(f.path)) return true
    return f.path.startsWith(DESIGN_PAGES_PREFIX) && f.path.endsWith('/index.html')
  })
}

export function listDesignMockupFiles<T extends DesignPageFileRef>(files: T[]): T[] {
  return files.filter((f) => isImageMockupPath(f.path))
}

function pagePassesCanvasFilter<T extends DesignPageFileRef>(
  page: DesignPageMeta,
  byPath: Map<string, T>,
): boolean {
  const mockupPath = page.mockupPath ?? pageMockupPath(page.id)
  const htmlPath = pageHtmlPath(page.id)
  return (
    byPath.has(page.path) ||
    byPath.has(mockupPath) ||
    byPath.has(htmlPath) ||
    page.frameType === 'prototype' ||
    page.frameType === 'designSystem' ||
    !page.path ||
    (page.media === 'html' && Boolean(page.id)) ||
    (page.media === 'image' && Boolean(page.id))
  )
}

/**
 * Un marco por pantalla: primero el mockup PNG; cuando existe HTML generado, ese marco pasa a HTML.
 */
export function expandCanvasPagesWithMockupFrames<T extends DesignPageFileRef>(
  pages: DesignPageMeta[],
  byPath: Map<string, T>,
): DesignPageMeta[] {
  const expanded: DesignPageMeta[] = []
  for (const page of pages) {
    if (
      isMockupCompanionCanvasPage(page) ||
      page.frameType === 'prototype' ||
      page.frameType === 'designSystem'
    ) {
      continue
    }

    const mockupPath = page.mockupPath ?? pageMockupPath(page.id)
    const htmlPath = pageHtmlPath(page.id)
    const hasMockupFile = byPath.has(mockupPath)
    const hasHtmlFile = hasRealHtmlFileInByPath(byPath, htmlPath, page.path)

    if (hasHtmlFile) {
      expanded.push({
        ...page,
        path: byPath.has(htmlPath) ? htmlPath : page.path,
        media: 'html',
        mockupPath: hasMockupFile ? mockupPath : page.mockupPath,
      })
      continue
    }

    if (hasMockupFile) {
      expanded.push({
        ...page,
        path: mockupPath,
        media: 'image',
        mockupPath,
      })
      continue
    }

    expanded.push(page)
  }
  return expanded
}

/** Descubre páginas desde archivos + spec; rellena posiciones si faltan. */
export function resolveDesignPages<T extends DesignPageFileRef>(
  files: T[],
  designJson: string | null,
): DesignPageMeta[] {
  const spec = parseDesignSpec(designJson)
  const pageFiles = listDesignPageFiles(files)
  const byPath = new Map<string, T>()
  for (const f of pageFiles) byPath.set(f.path, f)

  let pages: DesignPageMeta[] = []

  if (spec?.pages?.length) {
    pages = spec.pages
      .map((p) => {
        const mockupPath = p.mockupPath ?? pageMockupPath(p.id)
        const htmlPath = pageHtmlPath(p.id)
        let path = p.path
        if (byPath.has(htmlPath)) {
          path = htmlPath
        } else if (byPath.has(mockupPath)) {
          path = mockupPath
        } else if (byPath.has(p.path)) {
          path = p.path
        } else if (p.media === 'image' || p.path.endsWith('.png')) {
          path = p.path || mockupPath
        } else {
          path = p.path || htmlPath
        }
        const media =
          p.media ??
          (path.endsWith('.png') ? ('image' as const) : path.endsWith('.html') ? ('html' as const) : undefined)
        return {
          ...p,
          path,
          mockupPath: byPath.has(mockupPath) || p.mockupPath ? mockupPath : p.mockupPath,
          media: media ?? (path.endsWith('.png') ? 'image' : 'html'),
          width: p.width ?? DEFAULT_PAGE_WIDTH,
          height: p.height ?? DEFAULT_PAGE_HEIGHT,
          frameType: p.frameType,
        }
      })
      .filter((p) => pagePassesCanvasFilter(p, byPath))
  }

  if (!pages.length && pageFiles.length) {
    type Slot = { html?: T; png?: T }
    const slots = new Map<string, Slot>()
    for (const f of pageFiles) {
      if (isImageMockupPath(f.path)) {
        const id = f.path.slice(DESIGN_MOCKUPS_PREFIX.length, -4)
        const slot = slots.get(id) ?? {}
        slot.png = f
        slots.set(id, slot)
        continue
      }
      const id = parsePageIdFromPath(f.path)
      if (!id) continue
      const slot = slots.get(id) ?? {}
      slot.html = f
      slots.set(id, slot)
    }
    pages = [...slots.entries()].map(([id, slot]) => {
      const name =
        id === 'home'
          ? 'Inicio'
          : id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      if (slot.html && slot.png) {
        return {
          id,
          name,
          path: slot.html.path,
          media: 'html' as const,
          mockupPath: slot.png.path,
          width: DEFAULT_PAGE_WIDTH,
          height: DEFAULT_PAGE_HEIGHT,
          x: 0,
          y: 0,
        }
      }
      if (slot.html) {
        return {
          id,
          name,
          path: slot.html.path,
          media: 'html' as const,
          mockupPath: pageMockupPath(id),
          width: DEFAULT_PAGE_WIDTH,
          height: DEFAULT_PAGE_HEIGHT,
          x: 0,
          y: 0,
        }
      }
      return {
        id,
        name,
        path: slot.png!.path,
        media: 'image' as const,
        width: DEFAULT_PAGE_WIDTH,
        height: DEFAULT_PAGE_HEIGHT,
        x: 0,
        y: 0,
      }
    })
  }

  pages = expandCanvasPagesWithMockupFrames(pages, byPath)
  return autoLayoutPages(pages)
}

/**
 * Combina páginas ya existentes con las de un plan o stream nuevo: mantiene orden
 * y posición de las existentes y coloca las nuevas a la derecha del bloque actual.
 */
export function mergeDesignPages(
  existingPages: DesignPageMeta[],
  incomingPages: DesignPageMeta[],
): DesignPageMeta[] {
  if (!incomingPages.length) return existingPages
  if (!existingPages.length) return autoLayoutPages(incomingPages)

  const existingById = new Map(existingPages.map((p) => [p.id, p]))
  const preserved = existingPages.map((p) => {
    const next = incomingPages.find((i) => i.id === p.id)
    if (!next) return p
    return {
      ...p,
      ...next,
      path: next.path?.endsWith('.html') ? next.path : (p.path ?? next.path),
      mockupPath: next.mockupPath ?? p.mockupPath,
      x: p.x ?? next.x,
      y: p.y ?? next.y,
      width: p.width ?? next.width,
      height: p.height ?? next.height,
      media:
        p.media === 'html' || next.media === 'html' ? ('html' as const) : (next.media ?? p.media),
    }
  })

  const brandNew = incomingPages.filter((p) => !existingById.has(p.id))
  if (!brandNew.length) return preserved

  let maxRight = 0
  let minY = Infinity
  for (const p of preserved) {
    const w = p.width ?? DEFAULT_PAGE_WIDTH
    const px = p.x ?? 0
    const py = p.y ?? 0
    maxRight = Math.max(maxRight, px + w)
    minY = Math.min(minY, py)
  }
  const startX = maxRight + PAGE_GAP
  const startY = Number.isFinite(minY) ? minY : 0

  let x = startX
  const laidOutNew = brandNew.map((p) => {
    const w = p.width ?? DEFAULT_PAGE_WIDTH
    const placed: DesignPageMeta = {
      ...p,
      path: p.path?.endsWith('.html') ? p.path : pageHtmlPath(p.id),
      x,
      y: startY,
      width: p.width ?? DEFAULT_PAGE_WIDTH,
      height: p.height ?? DEFAULT_PAGE_HEIGHT,
    }
    x += w + PAGE_GAP
    return placed
  })

  return [...preserved, ...laidOutNew]
}

/** Pantallas del lienzo en fila horizontal (estilo Figma / Stitch). */
export function autoLayoutPages(pages: DesignPageMeta[]): DesignPageMeta[] {
  let x = 0
  const y = 0
  return pages.map((p, i) => {
    const w = p.width ?? DEFAULT_PAGE_WIDTH
    const h = p.height ?? DEFAULT_PAGE_HEIGHT
    let px = p.x
    let py = p.y
    if (px == null || py == null) {
      px = x
      py = y
      x += w + PAGE_GAP
    }
    return {
      ...p,
      id: p.id || `page-${i + 1}`,
      width: w,
      height: h,
      x: px ?? 0,
      y: py ?? 0,
    }
  })
}

/** Corrige specs antiguos con pantallas apiladas en columna (maxRowW 2400px). */
export function relayoutStackedScreenPages(pages: DesignPageMeta[]): DesignPageMeta[] {
  const screenPages = pages.filter(
    (p) =>
      p.frameType !== 'prototype' &&
      p.frameType !== 'designSystem' &&
      p.id !== '__prototype__' &&
      p.id !== '__design_system__' &&
      !isMockupCompanionCanvasPage(p),
  )
  if (screenPages.length < 2) return pages

  const xs = screenPages.map((p) => p.x ?? 0)
  const ys = screenPages.map((p) => p.y ?? 0)
  const stacked =
    xs.every((x) => x === xs[0]) && ys.every((y, i) => i === 0 || y > ys[i - 1]!)

  if (!stacked) return pages

  let startX = 0
  for (const p of pages) {
    if (p.frameType === 'designSystem' || p.id === '__design_system__') {
      startX = Math.max(startX, (p.x ?? 0) + (p.width ?? 360) + PAGE_GAP)
    }
  }

  const baseY = Math.min(...ys)
  let x = startX
  const byId = new Map<string, DesignPageMeta>()
  for (const p of screenPages) {
    const w = p.width ?? DEFAULT_PAGE_WIDTH
    byId.set(p.id, { ...p, x, y: baseY })
    x += w + PAGE_GAP
  }

  return pages.map((p) => byId.get(p.id) ?? p)
}

export function mergePagesIntoSpec(
  spec: DesignSpec | null,
  pages: DesignPageMeta[],
  title?: string,
): string {
  const base: DesignSpec = spec ?? {
    version: 2,
    title: title ?? 'Proyecto',
    summary: title ?? '',
    tokens: {
      colors: { primary: '#3b82f6', background: '#0f172a', text: '#f8fafc' },
      fonts: { body: 'system-ui', heading: 'system-ui' },
    },
    pages: [],
  }
  const projectName = title ?? base.title ?? 'Proyecto'
  const canvasPages = ensurePrototypePage(
    ensureDesignSystemPage(pages, base),
    projectName,
  )
  return JSON.stringify(
    {
      ...base,
      version: 2,
      pages: canvasPages.map((p) => ({
        id: p.id,
        name: p.name,
        path: p.path,
        width: p.width,
        height: p.height,
        x: p.x,
        y: p.y,
        ...(p.frameType ? { frameType: p.frameType } : {}),
        ...(p.media ? { media: p.media } : {}),
        ...(p.mockupPath ? { mockupPath: p.mockupPath } : {}),
        ...(p.imagePrompt ? { imagePrompt: p.imagePrompt } : {}),
        ...(p.aspectRatio ? { aspectRatio: p.aspectRatio } : {}),
        ...(p.regions?.length ? { regions: p.regions } : {}),
      })),
    },
    null,
    2,
  )
}

export function nextPageId(existing: DesignPageMeta[]): string {
  let n = existing.length + 1
  let id = `page-${n}`
  const ids = new Set(existing.map((p) => p.id))
  while (ids.has(id)) {
    n += 1
    id = `page-${n}`
  }
  return id
}

export function blankPageHtml(title: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: system-ui, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 2rem;
    }
    h1 { font-size: 1.75rem; margin-bottom: 0.75rem; }
    p { opacity: 0.85; line-height: 1.5; }
  </style>
</head>
<body>
  <h1 data-sk-id="sk-title">${title}</h1>
  <p data-sk-id="sk-lead">Página nueva — edítala con el asistente o la selección visual.</p>
</body>
</html>`
}

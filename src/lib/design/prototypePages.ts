import type { DesignPageMeta, DesignSpec, PrototypeLink } from '@/lib/design/types'

const PAGE_GAP = 64
const DEFAULT_PAGE_WIDTH = 390
const DEFAULT_PAGE_HEIGHT = 844
/** Marco Visual Language (paleta + tipografía) en el lienzo — proporción tablero Stitch. */
export const DESIGN_SYSTEM_FRAME_WIDTH = 1360
export const DESIGN_SYSTEM_FRAME_HEIGHT = 760

export const PROTOTYPE_PAGE_ID = '__prototype__'
export const DESIGN_SYSTEM_PAGE_ID = '__design_system__'

export function screenPagesOnly(pages: DesignPageMeta[]): DesignPageMeta[] {
  return pages.filter(
    (p) =>
      p.frameType !== 'prototype' &&
      p.frameType !== 'designSystem' &&
      p.id !== PROTOTYPE_PAGE_ID &&
      p.id !== DESIGN_SYSTEM_PAGE_ID,
  )
}

function isDesignSystemPage(p: DesignPageMeta): boolean {
  return p.frameType === 'designSystem' || p.id === DESIGN_SYSTEM_PAGE_ID
}

function isScreenCanvasPage(p: DesignPageMeta): boolean {
  return (
    !isDesignSystemPage(p) &&
    p.frameType !== 'prototype' &&
    p.id !== PROTOTYPE_PAGE_ID
  )
}

/** Visual Language siempre primero (izquierda); pantallas web a su derecha. */
export function ensureDesignSystemPage(
  pages: DesignPageMeta[],
  spec: DesignSpec | null,
): DesignPageMeta[] {
  const existingDs = pages.find(isDesignSystemPage)
  const fromSpec = spec?.pages?.find(isDesignSystemPage)
  const w = existingDs?.width ?? fromSpec?.width ?? DESIGN_SYSTEM_FRAME_WIDTH
  const h = existingDs?.height ?? fromSpec?.height ?? DESIGN_SYSTEM_FRAME_HEIGHT

  const designSystem: DesignPageMeta = {
    ...(existingDs ?? fromSpec ?? {
      id: DESIGN_SYSTEM_PAGE_ID,
      name: spec?.title ? `${spec.title} — Visual Language` : 'Visual Language',
      path: '',
      frameType: 'designSystem' as const,
    }),
    width: w,
    height: h,
    x: 0,
    y: 0,
    frameType: 'designSystem',
  }

  const others = pages.filter((p) => !isDesignSystemPage(p))
  const screens = others.filter(isScreenCanvasPage)
  const nonScreens = others.filter((p) => !isScreenCanvasPage(p))

  let screenX = w + PAGE_GAP
  const screenY = 0
  const laidOutScreens = screens.map((p) => {
    const pw = p.width ?? DEFAULT_PAGE_WIDTH
    const placed: DesignPageMeta = {
      ...p,
      x: screenX,
      y: screenY,
      width: pw,
      height: p.height ?? DEFAULT_PAGE_HEIGHT,
    }
    screenX += pw + PAGE_GAP
    return placed
  })

  return [designSystem, ...laidOutScreens, ...nonScreens]
}

export function ensurePrototypePage(
  pages: DesignPageMeta[],
  projectName: string,
): DesignPageMeta[] {
  if (pages.some((p) => p.frameType === 'prototype' || p.id === PROTOTYPE_PAGE_ID)) {
    return pages
  }
  const screens = screenPagesOnly(pages)
  if (!screens.length) return pages

  let maxX = 0
  let maxY = 0
  for (const p of pages) {
    maxX = Math.max(maxX, (p.x ?? 0) + (p.width ?? DEFAULT_PAGE_WIDTH))
    maxY = Math.max(maxY, (p.y ?? 0) + (p.height ?? DEFAULT_PAGE_HEIGHT))
  }

  const proto: DesignPageMeta = {
    id: PROTOTYPE_PAGE_ID,
    name: `Prototype: ${projectName}`,
    path: '',
    width: 320,
    height: 640,
    x: maxX + PAGE_GAP,
    y: 0,
    frameType: 'prototype',
  }
  return [...pages, proto]
}

/** Enlaces secuenciales por defecto (home → resto) para modo Play. */
export function defaultPrototypeLinks(pages: DesignPageMeta[]): PrototypeLink[] {
  const screens = screenPagesOnly(pages)
  if (screens.length < 2) return []
  const home = screens.find((p) => p.id === 'home') ?? screens[0]
  const links: PrototypeLink[] = []
  for (let i = 0; i < screens.length; i++) {
    const from = screens[i]
    const to = screens[i + 1]
    if (!from || !to) break
    links.push({
      id: `link-${from.id}-${to.id}`,
      fromPageId: from.id,
      fromSkId: `sk-nav-${to.id}`,
      toPageId: to.id,
      label: to.name,
    })
  }
  if (home && screens[1] && !links.some((l) => l.fromPageId === home.id)) {
    links.unshift({
      id: `link-${home.id}-${screens[1].id}`,
      fromPageId: home.id,
      fromSkId: 'sk-cta-explore',
      toPageId: screens[1].id,
    })
  }
  return links
}

export function mergePrototypeLinks(
  spec: DesignSpec | null,
  pages: DesignPageMeta[],
): PrototypeLink[] {
  const existing = spec?.prototypeLinks ?? []
  if (existing.length) return existing
  return defaultPrototypeLinks(pages)
}

export function nextLinkId(): string {
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

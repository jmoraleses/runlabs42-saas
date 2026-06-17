/** Elementos del DOM que el cursor Stitch debe visitar durante la generación. */
export type StitchCursorTarget = {
  x: number
  y: number
  width: number
  height: number
  score: number
}

const SCAN_TAGS = [
  'SECTION',
  'HEADER',
  'FOOTER',
  'MAIN',
  'ARTICLE',
  'NAV',
  'H1',
  'H2',
  'H3',
  'FORM',
  'UL',
  'OL',
  'LI',
  'BUTTON',
  'A',
  'IMG',
  'P',
  'DIV',
] as const

const TIP_X = 5.5
const TIP_Y = 3.5

function divScore(el: Element): number {
  const cn = typeof el.className === 'string' ? el.className : ''
  if (
    /hero|section|card|grid|container|banner|footer|header|nav|main|feature|product|catalog|cta|pricing|testimonial/i.test(
      cn,
    )
  ) {
    return 2
  }
  const ch = el.children.length
  if (ch >= 2 && el.getBoundingClientRect().height > 72) return 1
  return 0
}

export function stitchElementScore(el: Element): number {
  const t = el.tagName
  if (t === 'SECTION' || t === 'HEADER' || t === 'FOOTER' || t === 'MAIN' || t === 'ARTICLE' || t === 'NAV') {
    return 4
  }
  if (t === 'H1' || t === 'H2' || t === 'H3') return 3
  if (t === 'FORM' || t === 'UL' || t === 'OL' || t === 'IMG' || t === 'BUTTON') return 2
  if (t === 'LI' || t === 'P' || t === 'A') return 1
  if (t === 'DIV') return divScore(el)
  if (el.parentElement === el.ownerDocument.body) return 2
  return 0
}

export function isStitchCursorVisible(el: Element, viewport: { w: number; h: number }): boolean {
  const r = el.getBoundingClientRect()
  return (
    r.width > 20 &&
    r.height > 12 &&
    r.bottom > 4 &&
    r.right > 4 &&
    r.top < viewport.h + 40 &&
    r.left < viewport.w + 40
  )
}

export function isStitchCursorCandidate(el: Element): boolean {
  if (el.nodeType !== 1) return false
  if (el.closest('.rl42-stitch-cursor')) return false
  if (el.id === 'runlabs42-design-loading-css') return false
  const tag = el.tagName
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') return false
  return stitchElementScore(el) > 0
}

export function stitchTipPoint(
  rect: DOMRect,
  viewport: { w: number; h: number },
): { x: number; y: number } {
  const x = Math.max(8, Math.min(viewport.w - 28, rect.left + rect.width * 0.38 - TIP_X))
  const y = Math.max(8, Math.min(viewport.h - 28, rect.top + rect.height * 0.32 - TIP_Y))
  return { x, y }
}

/** Puntos de recorrido dentro de un bloque (esquinas + centro) para animación más rica. */
export function stitchWaypointsForRect(
  rect: DOMRect,
  viewport: { w: number; h: number },
): Array<{ x: number; y: number }> {
  const anchors = [
    [0.22, 0.28],
    [0.52, 0.38],
    [0.78, 0.55],
    [0.4, 0.72],
  ] as const
  return anchors.map(([fx, fy]) => {
    const x = Math.max(8, Math.min(viewport.w - 28, rect.left + rect.width * fx - TIP_X))
    const y = Math.max(8, Math.min(viewport.h - 28, rect.top + rect.height * fy - TIP_Y))
    return { x, y }
  })
}

export function collectStitchCursorTargets(doc: Document): StitchCursorTarget[] {
  const viewport = { w: doc.defaultView?.innerWidth ?? 800, h: doc.defaultView?.innerHeight ?? 600 }
  const seen = new Set<Element>()
  const out: StitchCursorTarget[] = []

  const push = (el: Element) => {
    if (seen.has(el) || !isStitchCursorCandidate(el) || !isStitchCursorVisible(el, viewport)) return
    seen.add(el)
    const rect = el.getBoundingClientRect()
    const score = stitchElementScore(el)
    out.push({ x: rect.left, y: rect.top, width: rect.width, height: rect.height, score })
  }

  for (const tag of SCAN_TAGS) {
    for (const el of doc.querySelectorAll(tag)) push(el)
  }

  out.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    if (a.x !== b.x) return a.x - b.x
    return b.score - a.score
  })
  return out
}

export function mapViewportPointToStage(
  point: { x: number; y: number },
  stage: HTMLElement,
): { x: number; y: number } {
  const stageRect = stage.getBoundingClientRect()
  return {
    x: point.x - stageRect.left,
    y: point.y - stageRect.top,
  }
}

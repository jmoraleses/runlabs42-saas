import type { DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import { DESIGN_BREAKPOINT_PRESETS } from '@/lib/design/breakpoints'
import { DESIGN_SYSTEM_FRAME_HEIGHT } from '@/lib/design/prototypePages'
import type { DesignPageMeta } from '@/lib/design/types'

export const PAGE_HEIGHT_MIN = 360
export const PAGE_HEIGHT_MAX = 4000

/** Alto por defecto del marco en el lienzo cuando aún no hay medición (p. ej. placeholder). */
export const CANVAS_FRAME_VIEWPORT_MAX = 1100

/** @deprecated Usar CANVAS_FRAME_VIEWPORT_MAX */
export const CANVAS_FRAME_MAX_HEIGHT = CANVAS_FRAME_VIEWPORT_MAX

export function clampPageHeight(height: number): number {
  return Math.min(PAGE_HEIGHT_MAX, Math.max(PAGE_HEIGHT_MIN, Math.round(height)))
}

/** Altura sugerida antes de tener HTML (por id/nombre de pantalla). */
export function suggestPageHeightFromMeta(
  page: Pick<DesignPageMeta, 'id' | 'name' | 'frameType'>,
  device: DesignPreviewBreakpoint = 'desktop',
): number {
  if (page.frameType === 'designSystem') return DESIGN_SYSTEM_FRAME_HEIGHT
  if (page.frameType === 'prototype') return 640

  const id = page.id.toLowerCase()
  const name = (page.name ?? '').toLowerCase()
  const key = `${id} ${name}`

  const preset = DESIGN_BREAKPOINT_PRESETS[device]

  if (/home|inicio|index|landing/.test(key)) {
    return clampPageHeight(Math.round(preset.height * 1.05))
  }
  if (/cart|carrito|basket|checkout/.test(key)) {
    return clampPageHeight(Math.round(preset.height * 0.55))
  }
  if (/catalog|catálogo|catalogo|shop|tienda|menu|menú|products|productos/.test(key)) {
    return clampPageHeight(Math.round(preset.height * 0.72))
  }
  if (/detail|detalle|product|item/.test(key)) {
    return clampPageHeight(Math.round(preset.height * 0.85))
  }
  if (/about|contact|faq|login|sign/.test(key)) {
    return clampPageHeight(Math.round(preset.height * 0.6))
  }

  return preset.height
}

/** min-height/height en vh o % que estiran al alto del iframe sin contenido real. */
export function isViewportStretchMinHeight(style: CSSStyleDeclaration): boolean {
  const minH = style.minHeight.trim()
  if (/^[\d.]+(vh|svh|lvh|dvh|%)$/.test(minH)) return true
  const h = style.height.trim()
  return /^[\d.]+(vh|svh|lvh|dvh|%)$/.test(h) && style.minHeight === '0px'
}

/** Altura visible del marco: mide el contenido real, no min-height de viewport. */
export function measureDocumentContentHeight(doc: Document): number {
  const body = doc.body
  if (!body) return 0

  const view = doc.defaultView
  let contentBottom = 0
  const bodyTop = body.getBoundingClientRect().top

  const measureEl = (el: HTMLElement) => {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return
    const style = view?.getComputedStyle(el)
    if (!style || style.display === 'none' || style.visibility === 'hidden') return
    if (style.position === 'fixed') return

    if (isViewportStretchMinHeight(style) && el.children.length > 0) {
      for (const child of Array.from(el.children)) {
        if (child instanceof HTMLElement) measureEl(child)
      }
      return
    }

    const rect = el.getBoundingClientRect()
    if (rect.height <= 0 && el.children.length === 0) return
    contentBottom = Math.max(contentBottom, Math.ceil(rect.bottom - bodyTop))

    if (el.children.length > 0 && rect.height > 400) {
      let childBottom = 0
      for (const child of Array.from(el.children)) {
        if (!(child instanceof HTMLElement)) continue
        const childStyle = view.getComputedStyle(child)
        if (childStyle.display === 'none' || childStyle.visibility === 'hidden') continue
        const childRect = child.getBoundingClientRect()
        childBottom = Math.max(childBottom, Math.ceil(childRect.bottom - bodyTop))
      }
      if (childBottom > 0 && childBottom < contentBottom - 80) {
        contentBottom = childBottom
      }
    }
  }

  for (const child of Array.from(body.children)) {
    if (child instanceof HTMLElement) measureEl(child)
  }

  const bodyStyle = view?.getComputedStyle(body)
  const bodyStretched = bodyStyle != null && isViewportStretchMinHeight(bodyStyle)

  if (contentBottom < 120 && !bodyStretched) {
    const root = doc.documentElement
    contentBottom = Math.max(
      root?.scrollHeight ?? 0,
      body.scrollHeight ?? 0,
      root?.offsetHeight ?? 0,
      body.offsetHeight ?? 0,
    )
  }

  return contentBottom
}

/** Altura de marco en el lienzo: prioriza medición real; acota spec inflado antes de medir. */
export function contentBoundedPageHeight(
  specHeight: number,
  measured: number | null | undefined,
): number {
  const cappedSpec = clampPageHeight(Math.min(specHeight, CANVAS_FRAME_VIEWPORT_MAX))
  if (measured == null || measured <= 0) return cappedSpec
  const m = clampPageHeight(measured)
  // Medición colgó del spec inflado (iframe alto + min-height:100vh): no agrandar el marco.
  if (
    specHeight > CANVAS_FRAME_VIEWPORT_MAX &&
    Math.abs(m - specHeight) < 64
  ) {
    return cappedSpec
  }
  return m
}

/** Estima la altura del mockup HTML a partir de su estructura (sin inflar por 100vh). */
export function estimateHtmlPageHeight(html: string, width: number): number {
  if (!html.trim()) return clampPageHeight(width * 1.2)

  let fromCss = 0
  for (const m of html.matchAll(/min-height:\s*(\d+(?:\.\d+)?)\s*px/gi)) {
    const v = Number(m[1])
    if (v > 240 && v < PAGE_HEIGHT_MAX) fromCss = Math.max(fromCss, v)
  }
  for (const m of html.matchAll(/height:\s*(\d+(?:\.\d+)?)\s*px/gi)) {
    const v = Number(m[1])
    if (v > 240 && v < PAGE_HEIGHT_MAX) fromCss = Math.max(fromCss, v)
  }

  const sections = (html.match(/<section\b/gi) ?? []).length
  const articles = (html.match(/<article\b/gi) ?? []).length
  const headers = (html.match(/<header\b/gi) ?? []).length
  const footers = (html.match(/<footer\b/gi) ?? []).length
  const heroes = (html.match(/hero|banner|jumbotron/gi) ?? []).length
  const cards = (html.match(/card|grid|product|gallery/gi) ?? []).length

  const blockEstimate =
    280 +
    headers * 64 +
    footers * 140 +
    sections * 360 +
    articles * 300 +
    Math.min(heroes, 2) * 280 +
    Math.min(Math.floor(cards / 4), 6) * 160

  const cap = clampPageHeight(Math.round(width * 1.35))
  return clampPageHeight(Math.min(Math.max(fromCss, blockEstimate, PAGE_HEIGHT_MIN), cap))
}

export function resolvePageCanvasHeight(
  page: Pick<DesignPageMeta, 'width' | 'height' | 'media' | 'frameType'>,
): number {
  const w = page.width ?? 390
  const specH = page.height ?? 844

  if (page.frameType === 'designSystem') {
    return clampPageHeight(Math.min(specH, 480))
  }

  if (page.media === 'image' || page.frameType === 'prototype') {
    const aspectTall = Math.round(w * (16 / 9))
    return clampPageHeight(Math.min(specH, aspectTall))
  }

  return clampPageHeight(Math.min(specH, CANVAS_FRAME_VIEWPORT_MAX))
}

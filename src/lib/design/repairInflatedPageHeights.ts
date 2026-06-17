import {
  DESIGN_BREAKPOINT_PRESETS,
  parseDesignDevice,
  type DesignPreviewBreakpoint,
} from '@/lib/design/breakpoints'
import {
  CANVAS_FRAME_VIEWPORT_MAX,
  estimateHtmlPageHeight,
  suggestPageHeightFromMeta,
} from '@/lib/design/pageHeight'
import { pageHtmlPath } from '@/lib/design/pages'
import type { DesignPageMeta, DesignSpec } from '@/lib/design/types'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'

export { DESIGN_SPEC_JSON }

export type PageHeightRepair = {
  pageId: string
  name: string
  from: number
  to: number
}

/** Altura de marco HTML en spec claramente inflada (p. ej. bucle 100vh + iframe alto). */
export function isInflatedHtmlPageHeight(
  page: Pick<DesignPageMeta, 'height' | 'frameType' | 'media'>,
): boolean {
  if (page.frameType === 'designSystem' || page.frameType === 'prototype') return false
  if (page.media === 'image') return false
  const h = page.height ?? 0
  return h > CANVAS_FRAME_VIEWPORT_MAX
}

export function suggestRepairedPageHeight(
  page: DesignPageMeta,
  htmlByPath: ReadonlyMap<string, string>,
  device: DesignPreviewBreakpoint = 'desktop',
): number {
  const width = page.width ?? DESIGN_BREAKPOINT_PRESETS[device].width
  const candidates = [
    page.path?.endsWith('.html') ? page.path : null,
    pageHtmlPath(page.id),
  ].filter((p): p is string => Boolean(p))

  for (const p of candidates) {
    const html = htmlByPath.get(p)?.trim()
    if (html) return estimateHtmlPageHeight(html, width)
  }

  return suggestPageHeightFromMeta(page, device)
}

/** Devuelve la nueva altura si conviene reparar; si no, null. */
export function repairPageHeightIfInflated(
  page: DesignPageMeta,
  htmlByPath: ReadonlyMap<string, string>,
  device: DesignPreviewBreakpoint = 'desktop',
): number | null {
  if (!isInflatedHtmlPageHeight(page)) return null
  const to = suggestRepairedPageHeight(page, htmlByPath, device)
  const from = page.height ?? 0
  if (Math.abs(to - from) < 48) return null
  return to
}

export function repairDesignSpecPageHeights(
  spec: DesignSpec,
  htmlByPath: ReadonlyMap<string, string> = new Map(),
): { spec: DesignSpec; repairs: PageHeightRepair[] } {
  const device = parseDesignDevice(spec.targetDevice)
  const repairs: PageHeightRepair[] = []

  const pages = (spec.pages ?? []).map((page) => {
    const to = repairPageHeightIfInflated(page, htmlByPath, device)
    if (to == null) return page
    repairs.push({
      pageId: page.id,
      name: page.name,
      from: page.height ?? 0,
      to,
    })
    return { ...page, height: to }
  })

  return { spec: { ...spec, pages }, repairs }
}

export function stringifyDesignSpec(spec: DesignSpec): string {
  return JSON.stringify(spec, null, 2)
}

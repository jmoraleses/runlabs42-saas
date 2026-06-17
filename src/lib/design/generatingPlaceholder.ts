import { DESIGN_BREAKPOINT_PRESETS, type DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import { pageHtmlPath } from '@/lib/design/pages'
import type { DesignPageMeta } from '@/lib/design/types'

export const DESIGN_GENERATING_PLACEHOLDER_ID = '__generating__'

export function isGeneratingPlaceholderPage(page: { id: string }): boolean {
  return page.id === DESIGN_GENERATING_PLACEHOLDER_ID
}

/** Marco transitorio con degradado mientras llega el plan del sitio. */
export function buildGeneratingPlaceholderPage(
  device: DesignPreviewBreakpoint,
): DesignPageMeta {
  const preset = DESIGN_BREAKPOINT_PRESETS[device]
  return {
    id: DESIGN_GENERATING_PLACEHOLDER_ID,
    name: '…',
    path: pageHtmlPath(DESIGN_GENERATING_PLACEHOLDER_ID),
    x: 0,
    y: 0,
    width: preset.width,
    height: preset.height,
    media: 'html',
    frameType: 'screen',
  }
}

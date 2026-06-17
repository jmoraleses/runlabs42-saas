import type { DesignPageMeta } from '@/lib/design/types'
import {
  CANVAS_FRAME_MAX_HEIGHT,
  CANVAS_FRAME_VIEWPORT_MAX,
  resolvePageCanvasHeight,
} from '@/lib/design/pageHeight'

export { CANVAS_FRAME_MAX_HEIGHT, CANVAS_FRAME_VIEWPORT_MAX }

/** Alto del marco en el lienzo (respeta height por página en el spec). */
export function canvasFrameHeight(page: Pick<DesignPageMeta, 'width' | 'height' | 'media' | 'frameType'>): number {
  return resolvePageCanvasHeight(page)
}

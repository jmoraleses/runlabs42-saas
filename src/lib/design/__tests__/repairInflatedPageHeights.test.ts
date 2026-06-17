import { describe, expect, it } from 'vitest'
import { CANVAS_FRAME_VIEWPORT_MAX } from '@/lib/design/pageHeight'
import {
  isInflatedHtmlPageHeight,
  repairDesignSpecPageHeights,
  repairPageHeightIfInflated,
} from '@/lib/design/repairInflatedPageHeights'
import type { DesignSpec } from '@/lib/design/types'

describe('repairInflatedPageHeights', () => {
  it('detects inflated HTML page heights', () => {
    expect(isInflatedHtmlPageHeight({ height: 2800, media: 'html' })).toBe(true)
    expect(isInflatedHtmlPageHeight({ height: 960, media: 'html' })).toBe(false)
    expect(isInflatedHtmlPageHeight({ height: 2800, media: 'image' })).toBe(false)
    expect(isInflatedHtmlPageHeight({ height: 2800, frameType: 'designSystem' })).toBe(false)
  })

  it('repairs inflated pages using HTML estimate', () => {
    const spec: DesignSpec = {
      version: 2,
      title: 'Test',
      summary: '',
      tokens: {},
      targetDevice: 'desktop',
      pages: [
        {
          id: 'home',
          name: 'Inicio',
          path: 'design/pages/home/index.html',
          width: 1280,
          height: 2800,
          media: 'html',
        },
      ],
    }
    const html = `<!DOCTYPE html><html><body><header></header><main><section></section></main><footer></footer></body></html>`
    const { spec: repaired, repairs } = repairDesignSpecPageHeights(
      spec,
      new Map([['design/pages/home/index.html', html]]),
    )
    expect(repairs).toHaveLength(1)
    expect(repairs[0]!.from).toBe(2800)
    expect(repairs[0]!.to).toBeLessThan(CANVAS_FRAME_VIEWPORT_MAX)
    expect(repaired.pages?.[0]?.height).toBe(repairs[0]!.to)
  })

  it('skips pages already within viewport cap', () => {
    const page = {
      id: 'cart',
      name: 'Carrito',
      path: 'design/pages/cart/index.html',
      height: 520,
      media: 'html' as const,
    }
    expect(repairPageHeightIfInflated(page, new Map())).toBeNull()
  })
})

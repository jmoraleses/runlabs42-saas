import { describe, expect, it } from 'vitest'
import {
  canvasFrameHeight,
  CANVAS_FRAME_MAX_HEIGHT,
  CANVAS_FRAME_VIEWPORT_MAX,
} from '@/lib/design/canvasFrame'
import {
  contentBoundedPageHeight,
  estimateHtmlPageHeight,
  isViewportStretchMinHeight,
  suggestPageHeightFromMeta,
} from '@/lib/design/pageHeight'

describe('pageHeight', () => {
  it('suggests taller home and shorter cart', () => {
    const home = suggestPageHeightFromMeta({ id: 'home', name: 'Inicio' }, 'desktop')
    const cart = suggestPageHeightFromMeta({ id: 'cart', name: 'Carrito' }, 'desktop')
    expect(home).toBeGreaterThan(cart)
  })

  it('estimates taller HTML for more sections', () => {
    const short = estimateHtmlPageHeight('<html><body><header></header><main><section></section></main><footer></footer></body></html>', 1280)
    const long = estimateHtmlPageHeight(
      `<html><body><header></header><main>${'<section class="hero"></section>'.repeat(6)}<footer></footer></main></body></html>`,
      1280,
    )
    expect(long).toBeGreaterThan(short)
  })

  it('caps inflated spec height on canvas for HTML pages', () => {
    const h = canvasFrameHeight({ width: 1280, height: 2800, media: 'html' })
    expect(h).toBe(CANVAS_FRAME_VIEWPORT_MAX)
    expect(h).toBeLessThan(2800)
  })

  it('caps image pages by aspect ratio', () => {
    const h = canvasFrameHeight({ width: 1280, height: 4000, media: 'image' })
    expect(h).toBeLessThan(2500)
  })

  it('does not inflate estimate from body min-height 100vh', () => {
    const html =
      '<!DOCTYPE html><html><head><style>body{margin:0;min-height:100vh}</style></head><body><header></header><main><section></section></main><footer></footer></body></html>'
    const h = estimateHtmlPageHeight(html, 390)
    expect(h).toBeLessThan(1200)
  })

  it('contentBoundedPageHeight prefers measured and caps spec before measure', () => {
    expect(contentBoundedPageHeight(2800, 920)).toBe(920)
    expect(contentBoundedPageHeight(2800, null)).toBe(CANVAS_FRAME_VIEWPORT_MAX)
    expect(contentBoundedPageHeight(2800, 2750)).toBe(CANVAS_FRAME_VIEWPORT_MAX)
    expect(contentBoundedPageHeight(1500, 1400)).toBe(1400)
  })

  it('detects viewport stretch min-height units', () => {
    const style = { minHeight: '100vh', height: 'auto' } as CSSStyleDeclaration
    expect(isViewportStretchMinHeight(style)).toBe(true)
    const px = { minHeight: '800px', height: 'auto' } as CSSStyleDeclaration
    expect(isViewportStretchMinHeight(px)).toBe(false)
  })

  it('desktop preset height is a reasonable viewport', () => {
    const home = suggestPageHeightFromMeta({ id: 'home', name: 'Inicio' }, 'desktop')
    expect(home).toBeLessThanOrEqual(CANVAS_FRAME_VIEWPORT_MAX)
    expect(home).toBeGreaterThan(700)
  })
})

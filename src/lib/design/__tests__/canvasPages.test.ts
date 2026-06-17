import { describe, expect, it } from 'vitest'
import {
  canClearStreamCanvasOverlay,
  mergeStreamCanvasOverlayPages,
  resolveDesignCanvasPages,
} from '@/lib/design/canvasPages'
import { DESIGN_GENERATING_PLACEHOLDER_ID } from '@/lib/design/generatingPlaceholder'
import type { DesignPageMeta } from '@/lib/design/types'

const spec = JSON.stringify({
  version: 2,
  title: 'Test',
  pages: [
    { id: 'home', name: 'Inicio', path: 'design/pages/home/index.html', x: 0, y: 0, width: 390, height: 844 },
    { id: 'about', name: 'About', path: 'design/pages/about/index.html', x: 500, y: 0, width: 390, height: 844 },
  ],
})

describe('resolveDesignCanvasPages', () => {
  it('keeps server pages when overlay is only the generating placeholder', () => {
    const refs = [
      { path: 'spec/design.json' },
      { path: 'design/pages/home/index.html' },
      { path: 'design/pages/about/index.html' },
    ]
    const placeholder: DesignPageMeta = {
      id: DESIGN_GENERATING_PLACEHOLDER_ID,
      name: '…',
      path: 'design/pages/__generating__/index.html',
      x: 0,
      y: 0,
      width: 390,
      height: 844,
    }
    const pages = resolveDesignCanvasPages(refs, spec, [placeholder])
    expect(pages.map((p) => p.id)).toEqual(expect.arrayContaining(['home', 'about']))
    expect(pages.some((p) => p.id === DESIGN_GENERATING_PLACEHOLDER_ID)).toBe(false)
  })

  it('con streamReplaceDesign no fusiona páginas antiguas del servidor', () => {
    const refs = [
      { path: 'spec/design.json' },
      { path: 'design/pages/home/index.html' },
    ]
    const newPlan: DesignPageMeta[] = [
      {
        id: 'catalog',
        name: 'Catálogo',
        path: 'design/pages/catalog/index.html',
        x: 0,
        y: 0,
        width: 1280,
        height: 900,
      },
    ]
    const pages = resolveDesignCanvasPages(refs, spec, newPlan, { streamReplaceDesign: true })
    expect(pages.map((p) => p.id)).toEqual(['catalog'])
    expect(pages.some((p) => p.id === 'home')).toBe(false)
  })

  it('merges stream pages with existing server pages', () => {
    const refs = [
      { path: 'spec/design.json' },
      { path: 'design/pages/home/index.html' },
      { path: 'design/pages/about/index.html' },
    ]
    const newPlan: DesignPageMeta[] = [
      { id: 'shop', name: 'Tienda', path: 'design/pages/shop/index.html', x: 0, y: 0, width: 390, height: 844 },
    ]
    const pages = resolveDesignCanvasPages(refs, spec, newPlan)
    expect(pages.map((p) => p.id)).toEqual(
      expect.arrayContaining(['home', 'about', 'shop']),
    )
  })

  it('mergeStreamCanvasOverlayPages ignores empty incoming and drops placeholder', () => {
    const placeholder: DesignPageMeta = {
      id: DESIGN_GENERATING_PLACEHOLDER_ID,
      name: '…',
      path: 'design/pages/__generating__/index.html',
      x: 0,
      y: 0,
      width: 390,
      height: 844,
    }
    const plan: DesignPageMeta[] = [
      { id: 'home', name: 'Inicio', path: 'design/pages/home/index.html', x: 0, y: 0, width: 390, height: 844 },
    ]
    expect(mergeStreamCanvasOverlayPages([placeholder], [])).toEqual([placeholder])
    expect(mergeStreamCanvasOverlayPages([placeholder], plan)?.map((p) => p.id)).toEqual(['home'])
    expect(mergeStreamCanvasOverlayPages(null, plan)?.map((p) => p.id)).toEqual(['home'])
  })

  it('canClearStreamCanvasOverlay waits for all spec html paths', () => {
    const overlay = {
      paths: ['design/pages/home/index.html'],
      pages: null,
    }
    const surfacePartial = {
      designJson: spec,
      paths: ['spec/design.json'],
    }
    expect(canClearStreamCanvasOverlay(overlay, surfacePartial)).toBe(false)

    const surfaceReady = {
      designJson: spec,
      paths: [
        'spec/design.json',
        'design/pages/home/index.html',
        'design/site/index.html',
        'design/pages/about/index.html',
      ],
    }
    expect(canClearStreamCanvasOverlay(overlay, surfaceReady)).toBe(true)
  })
})

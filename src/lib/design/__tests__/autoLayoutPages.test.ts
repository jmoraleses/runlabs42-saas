import { describe, expect, it } from 'vitest'
import { autoLayoutPages, relayoutStackedScreenPages } from '@/lib/design/pages'
import type { DesignPageMeta } from '@/lib/design/types'

describe('autoLayoutPages', () => {
  it('coloca pantallas desktop en una sola fila horizontal', () => {
    const pages: DesignPageMeta[] = [
      { id: 'home', name: 'Inicio', path: 'design/pages/home/index.html', width: 1280, height: 720 },
      { id: 'about', name: 'About', path: 'design/pages/about/index.html', width: 1280, height: 720 },
      { id: 'pricing', name: 'Pricing', path: 'design/pages/pricing/index.html', width: 1280, height: 720 },
    ]
    const laid = autoLayoutPages(pages)
    expect(laid.map((p) => p.y)).toEqual([0, 0, 0])
    expect(laid[0]?.x).toBe(0)
    expect(laid[1]?.x).toBeGreaterThan(laid[0]?.x ?? 0)
    expect(laid[2]?.x).toBeGreaterThan(laid[1]?.x ?? 0)
  })
})

describe('relayoutStackedScreenPages', () => {
  it('reorganiza columnas verticales en fila', () => {
    const stacked: DesignPageMeta[] = [
      { id: 'home', name: 'Inicio', path: 'design/pages/home/index.html', x: 424, y: 0, width: 1280, height: 720 },
      { id: 'about', name: 'About', path: 'design/pages/about/index.html', x: 424, y: 784, width: 1280, height: 720 },
      { id: 'pricing', name: 'Pricing', path: 'design/pages/pricing/index.html', x: 424, y: 1568, width: 1280, height: 720 },
    ]
    const laid = relayoutStackedScreenPages(stacked)
    expect(laid.every((p) => p.y === 0)).toBe(true)
    expect(laid[1]?.x).toBeGreaterThan(laid[0]?.x ?? 0)
    expect(laid[2]?.x).toBeGreaterThan(laid[1]?.x ?? 0)
  })
})

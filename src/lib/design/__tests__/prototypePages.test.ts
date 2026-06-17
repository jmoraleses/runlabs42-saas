import { describe, expect, it } from 'vitest'
import {
  DESIGN_SYSTEM_FRAME_WIDTH,
  DESIGN_SYSTEM_PAGE_ID,
  ensureDesignSystemPage,
} from '@/lib/design/prototypePages'
import type { DesignPageMeta } from '@/lib/design/types'

describe('ensureDesignSystemPage', () => {
  it('coloca Visual Language primero y desplaza pantallas a la derecha', () => {
    const screens: DesignPageMeta[] = [
      { id: 'home', name: 'Inicio', path: 'design/pages/home.html', width: 390, height: 844, x: 0, y: 0 },
      { id: 'pricing', name: 'Precios', path: 'design/pages/pricing.html', width: 390, height: 844, x: 454, y: 0 },
    ]

    const pages = ensureDesignSystemPage(screens, null)

    expect(pages[0]?.id).toBe(DESIGN_SYSTEM_PAGE_ID)
    expect(pages[0]?.x).toBe(0)
    expect(pages[1]?.id).toBe('home')
    expect(pages[1]?.x).toBe(DESIGN_SYSTEM_FRAME_WIDTH + 64)
    expect(pages[2]?.id).toBe('pricing')
    expect(pages[2]!.x!).toBeGreaterThan(pages[1]!.x!)
  })

  it('reordena si el design system venía después de las pantallas', () => {
    const pages: DesignPageMeta[] = [
      { id: 'home', name: 'Inicio', path: 'design/pages/home.html', width: 390, height: 844, x: 0, y: 0 },
      {
        id: DESIGN_SYSTEM_PAGE_ID,
        name: 'Visual Language',
        path: '',
        width: 1280,
        height: 900,
        x: 500,
        y: 0,
        frameType: 'designSystem',
      },
    ]

    const ordered = ensureDesignSystemPage(pages, null)

    expect(ordered[0]?.frameType).toBe('designSystem')
    expect(ordered[0]?.x).toBe(0)
    expect(ordered[1]?.id).toBe('home')
    expect(ordered[1]?.x).toBe((ordered[0]?.width ?? DESIGN_SYSTEM_FRAME_WIDTH) + 64)
  })
})

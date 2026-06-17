import { describe, expect, it } from 'vitest'
import {
  nextPagePinLabel,
  pageContextMarkerLabel,
  pagePinsFromSelectedPageIds,
  pagePinsPromptSuffix,
  type DesignPageContextPin,
} from '@/lib/design/elementContext'

describe('page context pins', () => {
  it('nextPagePinLabel asigna page1, page2, …', () => {
    const pins: DesignPageContextPin[] = []
    expect(nextPagePinLabel(pins)).toBe('page1')
    pins.push({ pageId: 'home', pageName: 'Inicio', label: 'page1' })
    expect(nextPagePinLabel(pins)).toBe('page2')
  })

  it('pageContextMarkerLabel muestra la etiqueta corta', () => {
    expect(
      pageContextMarkerLabel({
        pageId: 'home',
        pageName: 'Landing principal',
        label: 'page1',
      }),
    ).toBe('page1')
  })

  it('pagePinsFromSelectedPageIds refleja la selección del lienzo', () => {
    const pins = pagePinsFromSelectedPageIds(new Set(['home', 'pricing']), [
      { id: 'home', name: 'Inicio' },
      { id: 'pricing', name: 'Precios' },
    ])
    expect(pins).toHaveLength(2)
    expect(pins[0]).toMatchObject({ pageId: 'home', label: 'page1', pageName: 'Inicio' })
    expect(pins[1]).toMatchObject({ pageId: 'pricing', label: 'page2', pageName: 'Precios' })
  })

  it('pagePinsPromptSuffix pide no tocar otras pantallas', () => {
    const suffix = pagePinsPromptSuffix([
      { pageId: 'home', pageName: 'Inicio', label: 'page1' },
      { pageId: 'pricing', pageName: 'Precios', label: 'page2' },
    ])
    expect(suffix).toContain('page1')
    expect(suffix).toContain('page2')
    expect(suffix).toContain('No crees pantallas nuevas')
  })
})

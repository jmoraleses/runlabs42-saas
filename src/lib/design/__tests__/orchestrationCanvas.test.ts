import { describe, expect, it } from 'vitest'
import {
  buildInterimOrchestrationSpecFile,
  buildOrchestrationCanvasPages,
  buildTokensOnlyCanvasPages,
  buildTokensOnlySpecFile,
  resolveOrchestrationStreamPages,
} from '@/lib/design/orchestrationCanvas'
import { DESIGN_SYSTEM_PAGE_ID } from '@/lib/design/prototypePages'

describe('orchestrationCanvas', () => {
  const tokensJson = JSON.stringify({
    brand: { concept: 'Cactus Haven', tone: 'organic' },
    tokens: { colors: { primary: '#2d5016' }, ui: { layoutStyle: 'minimalist' } },
  })

  const layoutJson = JSON.stringify({
    pages: [
      { id: 'home', name: 'Inicio' },
      { id: 'catalog', name: 'Catálogo' },
    ],
  })

  it('builds canvas pages with design system frame', () => {
    const pages = buildOrchestrationCanvasPages(
      [{ id: 'home' }, { id: 'catalog' }],
      'desktop',
      tokensJson,
    )
    expect(pages.some((p) => p.id === DESIGN_SYSTEM_PAGE_ID)).toBe(true)
    expect(pages.filter((p) => p.frameType === 'screen')).toHaveLength(2)
  })

  it('builds tokens-only preview', () => {
    const pages = buildTokensOnlyCanvasPages(tokensJson, 'desktop')
    expect(pages).toHaveLength(1)
    expect(pages[0]?.id).toBe(DESIGN_SYSTEM_PAGE_ID)
  })

  it('builds interim spec without html files', () => {
    const interim = buildInterimOrchestrationSpecFile(layoutJson, tokensJson, 'desktop')
    expect(interim?.path).toBe('spec/design.json')
    expect(interim?.pages.length).toBeGreaterThanOrEqual(3)
  })

  it('builds tokens-only spec with design system page', () => {
    const interim = buildTokensOnlySpecFile(tokensJson, 'desktop')
    expect(interim.path).toBe('spec/design.json')
    expect(interim.pages.some((p) => p.id === DESIGN_SYSTEM_PAGE_ID)).toBe(true)
    const spec = JSON.parse(interim.content) as { tokens?: { colors?: { primary?: string } } }
    expect(spec.tokens?.colors?.primary).toBe('#2d5016')
  })

  it('resolveOrchestrationStreamPages usa tokens-only si layout vacío', () => {
    const specRaw = buildTokensOnlySpecFile(tokensJson, 'desktop').content
    const pages = resolveOrchestrationStreamPages({
      specRaw,
      tokensRaw: tokensJson,
      layoutRaw: '{}',
      device: 'desktop',
      pathRefs: [{ path: 'spec/design.json' }],
    })
    expect(pages.some((p) => p.id === DESIGN_SYSTEM_PAGE_ID)).toBe(true)
  })

  it('resolveOrchestrationStreamPages prioriza layout con páginas', () => {
    const pages = resolveOrchestrationStreamPages({
      specRaw: null,
      tokensRaw: tokensJson,
      layoutRaw: layoutJson,
      device: 'desktop',
      pathRefs: [],
    })
    expect(pages.filter((p) => p.frameType === 'screen')).toHaveLength(2)
  })
})

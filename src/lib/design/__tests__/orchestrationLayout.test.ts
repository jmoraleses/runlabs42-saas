import { describe, expect, it } from 'vitest'
import {
  layoutVarietyHints,
  validateLayoutPlan,
  validateLayoutPlanAgainstStitch,
  fallbackLayoutPagesForBrief,
} from '@/lib/design/orchestrationLayout'

describe('validateLayoutPlan', () => {
  const tokensBrutalist = JSON.stringify({
    tokens: { ui: { layoutStyle: 'brutalist' } },
  })

  it('rejects classic hero stack on home', () => {
    const layout = JSON.stringify({
      pages: [
        {
          id: 'home',
          sections: [
            { type: 'navigation' },
            { type: 'hero' },
            { type: 'features' },
            { type: 'footer' },
          ],
        },
      ],
    })
    const result = validateLayoutPlan(layout, tokensBrutalist)
    expect(result.ok).toBe(false)
  })

  it('acepta navigation→hero→features si hay referencia visual sin perfil de auditoría', () => {
    const layout = JSON.stringify({
      pages: [
        {
          id: 'home',
          sections: [
            { type: 'navigation' },
            { type: 'hero' },
            { type: 'features' },
          ],
        },
      ],
    })
    const result = validateLayoutPlan(layout, tokensBrutalist, { hasVisualReference: true })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('referencia visual')
    }
  })

  it('rechaza hero→features plano si la referencia Stitch usa bento', () => {
    const layout = JSON.stringify({
      pages: [
        {
          id: 'home',
          sections: [
            { type: 'navigation' },
            { type: 'hero' },
            { type: 'features' },
            { type: 'footer' },
          ],
        },
      ],
    })
    const refHtml = '<!-- bento benefits --><div class="md:col-span-2 bento">Trust</div>'
    const result = validateLayoutPlan(layout, tokensBrutalist, {
      stitchReferenceHtml: refHtml,
    })
    expect(result.ok).toBe(false)
  })

  it('accepts unconventional sections for brutalist', () => {
    const layout = JSON.stringify({
      pages: [
        {
          id: 'home',
          sections: [
            { type: 'navigation' },
            { type: 'marquee', composition: 'full-bleed' },
            { type: 'bento' },
          ],
        },
      ],
    })
    const result = validateLayoutPlan(layout, tokensBrutalist)
    expect(result.ok).toBe(true)
  })
})

describe('layoutVarietyHints', () => {
  it('prioriza fidelidad cuando hay referencia visual', () => {
    const hints = layoutVarietyHints('{}', { prompt: 'yoga' }, { hasVisualReference: true })
    expect(hints).toContain('Fidelidad')
    expect(hints).not.toContain('Variabilidad')
  })

  it('usa hints del perfil visual cuando existe auditoría', () => {
    const hints = layoutVarietyHints(
      '{}',
      { prompt: 'tienda' },
      {
        visualProfile: {
          layoutTopology: 'ecommerce-catalog',
          sectionTypes: ['product-grid'],
        },
      },
    )
    expect(hints).toContain('ecommerce-catalog')
    expect(hints).toContain('product-grid')
  })

  it('mentions layout style from tokens', () => {
    const hints = layoutVarietyHints(
      JSON.stringify({ tokens: { ui: { layoutStyle: 'asymmetric-grid' } } }),
      { prompt: 'x', siteType: 'landing' },
    )
    expect(hints).toContain('asymmetric-grid')
    expect(hints).toContain('Variabilidad')
  })

  it('incluye hints de sector automotriz sin imagen', () => {
    const hints = layoutVarietyHints(
      '{}',
      { prompt: 'Concesionario de coches eléctricos premium' },
      { hasVisualReference: false },
    )
    expect(hints).toContain('automotriz')
    expect(hints).toContain('full-bleed')
  })
})

describe('validateLayoutPlanAgainstStitch', () => {
  it('acepta layout con bento cuando la referencia lo usa', () => {
    const layout = JSON.stringify({
      pages: [
        {
          id: 'home',
          sections: [
            { type: 'site-header' },
            { type: 'hero-split' },
            { type: 'bento-benefits', composition: 'asymmetric' },
            { type: 'product-grid' },
            { type: 'site-footer' },
          ],
        },
      ],
    })
    const refHtml =
      '<!-- bento --><section class="md:col-span-2">Why</section><div class="grid-cols-3 product chick">'
    expect(validateLayoutPlanAgainstStitch(layout, refHtml).ok).toBe(true)
  })
})

describe('fallbackLayoutPagesForBrief', () => {
  it('con visualReferenceOnly no usa plantilla landing genérica', () => {
    const pages = fallbackLayoutPagesForBrief(
      { prompt: 'test', siteType: 'landing' },
      null,
      { visualReferenceOnly: true },
    )
    const types = pages[0]?.sections?.map((s) => String(s.type))
    expect(types).not.toContain('navigation')
    expect(types).not.toContain('hero')
    expect(types).not.toContain('features')
  })

  it('provides home with unconventional sections', () => {
    const pages = fallbackLayoutPagesForBrief({ prompt: 'test', siteType: 'landing' })
    expect(pages[0]?.id).toBe('home')
    expect(pages[0]?.sections?.some((s) => s.type === 'bento')).toBe(true)
  })

  it('adds catalog for ecommerce', () => {
    const pages = fallbackLayoutPagesForBrief({ prompt: 'shop', siteType: 'ecommerce' })
    expect(pages.some((p) => p.id === 'catalog')).toBe(true)
  })
})

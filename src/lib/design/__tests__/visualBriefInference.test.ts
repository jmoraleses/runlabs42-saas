import { describe, expect, it } from 'vitest'
import {
  isVisualProfileActionable,
  layoutPagesFromVisualProfile,
  mergeVisualInferenceIntoBrief,
  siteTypeFromVisualTopology,
  topologyDefaultSectionTypes,
  visualAuditPromptBlock,
  visualReferenceLayoutHintsFromProfile,
} from '@/lib/design/visualBriefInference'
import {
  validateLayoutPlan,
  validateLayoutPlanAgainstVisualProfile,
} from '@/lib/design/orchestrationLayout'

describe('visualBriefInference', () => {
  it('isVisualProfileActionable exige paleta y estructura', () => {
    expect(
      isVisualProfileActionable({
        layoutTopology: 'other',
        sectionTypes: [],
      }),
    ).toBe(false)
    expect(
      isVisualProfileActionable({
        layoutTopology: 'landing-marketing',
        sectionTypes: ['hero-split'],
        dominantColors: ['#5c7a5c'],
      }),
    ).toBe(true)
  })

  it('visualAuditPromptBlock incluye JSON del perfil', () => {
    const block = visualAuditPromptBlock({
      layoutTopology: 'landing-marketing',
      sectionTypes: ['hero-split'],
      brandName: 'MarcaX',
      dominantColors: ['#5c7a5c'],
    })
    expect(block).toContain('MarcaX')
    expect(block).toContain('"layoutTopology"')
  })

  it('mergeVisualInferenceIntoBrief prioriza siteType de la captura sobre el texto', () => {
    const brief = mergeVisualInferenceIntoBrief(
      { prompt: 'landing startup marketing', siteType: 'landing' },
      {
        siteType: 'ecommerce',
        layoutTopology: 'ecommerce-catalog',
        sectionTypes: ['site-header', 'product-grid'],
        brandName: 'PetVibe',
        dominantColors: ['#3E5641', '#E67E5F'],
        brandTone: 'premium mascotas',
      },
    )
    expect(brief.siteType).toBe('ecommerce')
    expect(brief.prompt).toContain('PetVibe')
    expect(brief.prompt).toContain('#3E5641')
    expect(brief.brandTone).toBe('premium mascotas')
  })

  it('mergeVisualInferenceIntoBrief incluye roles cromáticos de badges', () => {
    const brief = mergeVisualInferenceIntoBrief(
      { prompt: 'catálogo mascotas' },
      {
        layoutTopology: 'ecommerce-catalog',
        sectionTypes: ['product-grid'],
        colorRoles: {
          ctaPrimary: '#3e5641',
          badgeNew: '#e67e5f',
          badgeTopSales: '#d4a5a5',
        },
      },
    )
    expect(brief.prompt).toContain('#e67e5f')
    expect(brief.prompt).toContain('#d4a5a5')
    expect(brief.prompt).toContain('tertiary')
  })

  it('siteTypeFromVisualTopology mapea catálogo a ecommerce', () => {
    expect(siteTypeFromVisualTopology('ecommerce-catalog')).toBe('ecommerce')
    expect(siteTypeFromVisualTopology('landing-marketing')).toBe('landing')
  })

  it('layoutPagesFromVisualProfile usa sectionTypes de la auditoría sin hero genérico', () => {
    const pages = layoutPagesFromVisualProfile({
      layoutTopology: 'ecommerce-catalog',
      sectionTypes: ['site-header', 'catalog-sidebar', 'product-grid', 'site-footer'],
      brandName: 'PetVibe',
    })
    expect(pages[0]?.layoutStrategy).toBe('visual-reference-fidelity')
    const types = pages[0]?.sections?.map((s) => s.type)
    expect(types).toEqual(['site-header', 'catalog-sidebar', 'product-grid', 'site-footer'])
    expect(types).not.toContain('hero')
    expect(types).not.toContain('features')
  })

  it('topologyDefaultSectionTypes evita navigation→hero→features', () => {
    const types = topologyDefaultSectionTypes('ecommerce-catalog')
    expect(types.join(' ')).toMatch(/product-grid/)
    expect(types).not.toContain('features')
  })

  it('topologyDefaultSectionTypes landing-marketing es mínimo sin imponer secciones', () => {
    const types = topologyDefaultSectionTypes('landing-marketing')
    expect(types).toEqual(['site-header', 'main-content', 'site-footer'])
  })

  it('topologyDefaultSectionTypes mobile-app-screen incluye bottom-nav', () => {
    const types = topologyDefaultSectionTypes('mobile-app-screen')
    expect(types).toContain('bottom-nav')
    expect(types).toContain('hero-media-overlay')
  })

  it('mergeVisualInferenceIntoBrief elimina requiredSections del texto', () => {
    const brief = mergeVisualInferenceIntoBrief(
      { prompt: 'contacto y catálogo', requiredSections: ['contact', 'pricing'] },
      {
        layoutTopology: 'mobile-app-screen',
        sectionTypes: ['bottom-nav'],
        brandName: 'NEON DREAMS',
        dominantColors: ['#1a1a2e', '#ff6b9d'],
      },
    )
    expect(brief.requiredSections).toBeUndefined()
  })

  it('layoutPagesFromVisualProfile usa sectionTypes de la auditoría', () => {
    const sections = [
      'site-header',
      'hero-split',
      'value-proposition',
      'bento-grid',
      'site-footer',
    ]
    const pages = layoutPagesFromVisualProfile({
      layoutTopology: 'landing-marketing',
      brandName: 'MarcaAudit',
      sectionTypes: sections,
    })
    expect(pages[0]?.sections?.map((s) => s.type)).toEqual(sections)
  })

  it('visualReferenceLayoutHintsFromProfile exige product-grid en catálogo', () => {
    const hints = visualReferenceLayoutHintsFromProfile({
      layoutTopology: 'ecommerce-catalog',
      sectionTypes: ['site-header', 'catalog-sidebar', 'product-grid'],
      dominantColors: ['#3E5641'],
    })
    expect(hints).toContain('product-grid')
    expect(hints).toContain('ecommerce-catalog')
  })
})

describe('validateLayoutPlanAgainstVisualProfile', () => {
  const tokens = JSON.stringify({ tokens: { ui: { layoutStyle: 'minimalist' } } })

  it('rechaza landing hero→features si la captura es catálogo', () => {
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
    const result = validateLayoutPlanAgainstVisualProfile(layout, {
      layoutTopology: 'ecommerce-catalog',
      sectionTypes: ['site-header', 'catalog-sidebar', 'product-grid'],
    })
    expect(result.ok).toBe(false)
  })

  it('acepta layout con product-grid y sidebar', () => {
    const layout = JSON.stringify({
      pages: [
        {
          id: 'home',
          sections: [
            { type: 'site-header' },
            { type: 'catalog-sidebar' },
            { type: 'product-grid' },
            { type: 'site-footer' },
          ],
        },
      ],
    })
    const result = validateLayoutPlanAgainstVisualProfile(layout, {
      layoutTopology: 'ecommerce-catalog',
      sectionTypes: ['site-header', 'catalog-sidebar', 'product-grid'],
    })
    expect(result.ok).toBe(true)
  })

  it('validateLayoutPlan usa perfil visual en lugar de aceptar todo', () => {
    const layout = JSON.stringify({
      pages: [
        {
          id: 'home',
          sections: [{ type: 'navigation' }, { type: 'hero' }, { type: 'features' }],
        },
      ],
    })
    const result = validateLayoutPlan(layout, tokens, {
      hasVisualReference: true,
      visualProfile: {
        layoutTopology: 'ecommerce-catalog',
        sectionTypes: ['product-grid', 'catalog-sidebar'],
      },
    })
    expect(result.ok).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  isClassicGenericLandingPattern,
  isGenericAgencyLandingHtml,
  validateHtmlAgainstVisualProfile,
  visualReferenceHtmlStructureBlock,
} from '@/lib/design/visualHtmlFidelity'

const WELLNESS_PROFILE = {
  layoutTopology: 'landing-marketing' as const,
  brandName: 'AcmeWellness',
  dominantColors: ['#f5f3ef', '#5c7a5c', '#8fbc8f'],
  sectionTypes: ['site-header', 'hero-split', 'bento-grid', 'site-footer'],
}

describe('visualHtmlFidelity', () => {
  it('detecta patrón estructural hero+features sin listas de copy', () => {
    const html = `<html><body><nav></nav><section class="hero"></section><section class="features"></section></body></html>`
    expect(isClassicGenericLandingPattern(html)).toBe(true)
  })

  it('rechaza HTML con paleta alejada de la captura', () => {
    const html = `<!DOCTYPE html><html><body style="background:#2563eb">
      <header>AcmeWellness</header>
      <section data-sk-id="sk-hero-split" class="hero-split"></section>
      <section data-sk-id="sk-bento-grid" class="bento-grid"></section>
      <button style="background:#1d4ed8">CTA</button>
    </body></html>`
    const result = validateHtmlAgainstVisualProfile(html, WELLNESS_PROFILE)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/paleta|colores/i)
  })

  it('rechaza HTML sin marca cuando el perfil la define', () => {
    const html = `<!DOCTYPE html><html><body>
      <header>Marca Incorrecta</header>
      <section data-sk-id="sk-hero-split"></section>
      <section data-sk-id="sk-bento-grid"></section>
    </body></html>`
    const result = validateHtmlAgainstVisualProfile(html, WELLNESS_PROFILE)
    expect(result.ok).toBe(false)
  })

  it('acepta HTML alineado con perfil de auditoría', () => {
    const html = `<!DOCTYPE html><html><body>
      <header data-sk-id="sk-site-header"><span>AcmeWellness</span></header>
      <section data-sk-id="sk-hero-split" class="hero-split"><h1>Título</h1></section>
      <section data-sk-id="sk-bento-grid" class="bento-grid"></section>
      <footer data-sk-id="sk-site-footer"></footer>
      <button class="bg-primary text-on-primary">Comenzar</button>
    </body></html>`
    const result = validateHtmlAgainstVisualProfile(html, WELLNESS_PROFILE)
    expect(result.ok).toBe(true)
  })

  it('isGenericAgencyLandingHtml usa sectionTypes del perfil', () => {
    const html = `<html><body><nav></nav><section class="hero"></section><section class="features"></section></body></html>`
    expect(isGenericAgencyLandingHtml(html, WELLNESS_PROFILE)).toBe(true)
  })

  it('visualReferenceHtmlStructureBlock usa datos del perfil', () => {
    const block = visualReferenceHtmlStructureBlock({
      layoutTopology: 'ecommerce-catalog',
      sectionTypes: ['site-header', 'product-grid'],
      brandName: 'TiendaX',
      dominantColors: ['#3e5641'],
    })
    expect(block).toContain('product-grid')
    expect(block).toContain('TiendaX')
    expect(block).toContain('#3e5641')
    expect(block).not.toMatch(/Innovación Digital/)
  })
})

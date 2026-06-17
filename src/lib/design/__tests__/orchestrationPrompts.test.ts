import { describe, it, expect } from 'vitest'
import {
  paletteGenerationSystemInstruction,
  typographyUiSystemInstruction,
  tokensReviewSystemInstruction,
  visualIdentitySystemInstruction,
  layoutOrchestratorSystemInstruction,
  contentComponentSystemInstruction,
  assetPlannerSystemInstruction,
} from '../orchestrationPrompts'

describe('orchestrationPrompts', () => {
  it('should return palette generation instruction with tertiary schema', () => {
    const prompt = paletteGenerationSystemInstruction()
    expect(prompt).toContain('AGENTE DE PALETA')
    expect(prompt).toContain('tertiary')
    expect(prompt).toContain('brand.concept')
  })

  it('should return typography-ui instruction', () => {
    const prompt = typographyUiSystemInstruction()
    expect(prompt).toContain('AGENTE DE TIPOGRAFÍA')
    expect(prompt).toContain('typography')
  })

  it('should return tokens review instruction', () => {
    const prompt = tokensReviewSystemInstruction()
    expect(prompt).toContain('AGENTE DE REVISIÓN')
    expect(prompt).toContain('tertiary')
  })

  it('should return visual identity system instruction', () => {
    const prompt = visualIdentitySystemInstruction()
    expect(prompt).toContain('director de arte')
    expect(prompt).toContain('objeto JSON válido')
    expect(prompt).toContain('"brand"')
  })

  it('should return layout orchestrator system instruction', () => {
    const prompt = layoutOrchestratorSystemInstruction('desktop')
    expect(prompt).toContain('arquitecto de interfaces')
    expect(prompt).toContain('"pages"')
    expect(prompt).toContain('home')
  })

  it('layout con referencia visual prioriza fidelidad a la captura', () => {
    const prompt = layoutOrchestratorSystemInstruction('desktop', {
      hasVisualReference: true,
    })
    expect(prompt).toContain('REFERENCIA VISUAL')
    expect(prompt).toContain('cart-line-items')
    expect(prompt).toContain('fidelidad')
  })

  it('content con referencia visual incluye reglas HTML de fidelidad', () => {
    const prompt = contentComponentSystemInstruction('desktop', [{ id: 'cart', name: 'Carrito' }], {
      hasVisualReference: true,
    })
    expect(prompt).toContain('REFERENCIA VISUAL — HTML')
    expect(prompt).toContain('design/pages/cart/index.html')
  })

  it('should return asset planner system instruction', () => {
    const prompt = assetPlannerSystemInstruction()
    expect(prompt).toContain('"assets"')
    expect(prompt).toContain('assets/hero.jpg')
  })

  it('should return content component system instruction with canvas paths', () => {
    const prompt = contentComponentSystemInstruction('desktop', [
      { id: 'home', name: 'Inicio' },
      { id: 'pricing', name: 'Precios' },
    ])
    expect(prompt).toContain('desarrollador frontend')
    expect(prompt).toContain('design/site/index.html')
    expect(prompt).toContain('design/pages/pricing/index.html')
    expect(prompt).toContain('[IMAGE:')
  })
})

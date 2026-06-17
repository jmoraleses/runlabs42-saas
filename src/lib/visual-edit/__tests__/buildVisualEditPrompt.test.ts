import { describe, expect, it } from 'vitest'
import { buildVisualEditPrompt, sourceFileForElement } from '@/lib/visual-edit/buildVisualEditPrompt'
import type { ElementDescriptor } from '@/lib/visual-edit/protocol'

const baseElement: ElementDescriptor = {
  skId: 'hero-title',
  tagName: 'h1',
  rect: { top: 0, left: 0, width: 100, height: 40 },
  text: 'Bienvenido',
  styles: { fontSize: '24px', color: 'rgb(0,0,0)' },
  source: { file: 'src/App.tsx', line: 12 },
}

describe('buildVisualEditPrompt', () => {
  it('incluye id, archivo y pedido del usuario', () => {
    const prompt = buildVisualEditPrompt(baseElement, 'Haz el título más grande y azul')
    expect(prompt).toContain('hero-title')
    expect(prompt).toContain('src/App.tsx')
    expect(prompt).toContain('Bienvenido')
    expect(prompt).toContain('Haz el título más grande y azul')
    expect(prompt).toContain('data-sk-id')
  })

  it('resuelve archivo desde ELEMENT_MAP', () => {
    expect(sourceFileForElement({ ...baseElement, skId: 'pricing-title', source: undefined })).toBe(
      'src/components/PricingCard.tsx',
    )
  })
})

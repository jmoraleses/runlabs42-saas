import { describe, expect, it } from 'vitest'
import {
  buildOrchestrationFallbackHtml,
  isOrchestrationPlaceholderHtml,
} from '@/lib/design/orchestrationFallbackHtml'
import { isCompleteOrchestrationPageHtml } from '@/lib/design/orchestrationHtmlQuality'
import { pageHtmlPath } from '@/lib/design/pages'

describe('isOrchestrationPlaceholderHtml', () => {
  it('detecta el borrador genérico de orquestación', () => {
    const file = buildOrchestrationFallbackHtml(
      { id: 'home', name: 'Inicio' },
      JSON.stringify({ brand: { concept: 'Demo' }, tokens: { colors: { primary: '#000' } } }),
      'desktop',
    )
    expect(isOrchestrationPlaceholderHtml(file.content)).toBe(true)
  })

  it('no marca HTML de producto real', () => {
    expect(
      isOrchestrationPlaceholderHtml('<!DOCTYPE html><html><body><h1>Tienda</h1></body></html>'),
    ).toBe(false)
  })
})

describe('buildOrchestrationFallbackHtml', () => {
  it('genera HTML en ruta de lienzo para home', () => {
    const tokensJson = JSON.stringify({
      brand: { concept: 'Tienda Demo' },
      tokens: { colors: { primary: '#112233', background: '#fff', text: '#000', surface: '#f5f5f5' } },
    })
    const file = buildOrchestrationFallbackHtml({ id: 'home', name: 'Inicio' }, tokensJson, 'desktop')
    expect(file.path).toBe(pageHtmlPath('home'))
    expect(file.content).toContain('<!DOCTYPE html>')
    expect(file.content).toContain('data-sk-id')
    expect(file.content).toContain('Tienda Demo')
    expect(file.content.length).toBeGreaterThanOrEqual(1200)
    expect(isCompleteOrchestrationPageHtml(file.content)).toBe(true)
  })

  it('genera HTML para páginas internas', () => {
    const file = buildOrchestrationFallbackHtml(
      { id: 'catalog', name: 'Catálogo' },
      JSON.stringify({ brand: { concept: 'Shop' }, tokens: { colors: { primary: '#000' } } }),
      'desktop',
    )
    expect(file.path).toBe(pageHtmlPath('catalog'))
    expect(file.content).toContain('Catálogo')
  })
})

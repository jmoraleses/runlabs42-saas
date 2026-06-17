import { describe, expect, it } from 'vitest'
import {
  composeOrchestrationUserPrompt,
  resolveOrchestrationLocale,
} from '@/lib/design/designBrief'

describe('resolveOrchestrationLocale', () => {
  it('usa español por defecto', () => {
    expect(resolveOrchestrationLocale({ prompt: 'Tienda de pollitos amarillos' })).toBe('es')
  })

  it('respeta locale explícito en', () => {
    expect(resolveOrchestrationLocale({ prompt: 'x', locale: 'en' })).toBe('en')
  })

  it('detecta inglés en el prompt', () => {
    expect(resolveOrchestrationLocale({ prompt: 'Landing in English for a coffee brand' })).toBe(
      'en',
    )
  })
})

describe('composeOrchestrationUserPrompt', () => {
  it('inyecta reglas de idioma español', () => {
    const p = composeOrchestrationUserPrompt({ prompt: 'Landing para cafetería artesanal' })
    expect(p).toContain('Idioma de la interfaz')
    expect(p).toContain('español')
    expect(p).toContain('lang="es"')
    expect(p).not.toContain('Pollitos Amarillos')
  })
})

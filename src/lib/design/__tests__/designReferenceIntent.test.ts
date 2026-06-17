import { describe, expect, it } from 'vitest'
import { promptImpliesVisualReference } from '@/lib/design/designReferenceIntent'

describe('promptImpliesVisualReference', () => {
  it('detecta intención de réplica de captura', () => {
    expect(promptImpliesVisualReference('Réplica fiel de la captura adjunta')).toBe(true)
    expect(promptImpliesVisualReference('Landing como la imagen')).toBe(true)
  })

  it('no marca prompts genéricos', () => {
    expect(promptImpliesVisualReference('Innovación y diseño para startups')).toBe(false)
  })
})

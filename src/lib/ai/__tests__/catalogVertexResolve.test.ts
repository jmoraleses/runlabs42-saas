import { describe, expect, it } from 'vitest'
import {
  normalizeVertexModelIdForCatalog,
  resolveCatalogModelForVertexId,
} from '@/lib/ai/catalogVertexResolve'

describe('resolveCatalogModelForVertexId', () => {
  it('resuelve alias google/ y @anthropic', () => {
    const r = resolveCatalogModelForVertexId('claude-sonnet-4-6@anthropic')
    expect(r?.catalogId).toBe('claude-sonnet-4-6')
    expect(r?.model.pricing.inputPerM).not.toBeNull()
  })

  it('resuelve gemini-2.0-flash-001 vía alias de catálogo', () => {
    const r = resolveCatalogModelForVertexId('gemini-2.0-flash-001')
    expect(r?.catalogId).toBe('google/gemini-2.0-flash-001')
    expect(r?.model.pricing.inputPerM).not.toBeNull()
  })

  it('resuelve familia gemini-2.5-flash-*', () => {
    const r = resolveCatalogModelForVertexId('gemini-2.5-flash-002')
    expect(r?.catalogId).toBe('gemini-2.5-flash')
    expect(['family', 'alias']).toContain(r?.match)
    expect(r?.model.pricing.inputPerM).not.toBeNull()
  })

  it('resuelve deepseek con ID corto', () => {
    const r = resolveCatalogModelForVertexId('deepseek-v3.2-maas')
    expect(r?.catalogId).toBe('deepseek-ai/deepseek-v3.2-maas')
    expect(r?.model.pricing.outputPerM).not.toBeNull()
  })

  it('normaliza google/ prefix', () => {
    expect(normalizeVertexModelIdForCatalog('google/gemini-2.5-flash')).toBe('gemini-2.5-flash')
  })
})

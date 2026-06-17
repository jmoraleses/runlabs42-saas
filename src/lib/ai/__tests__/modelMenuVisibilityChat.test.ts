import { describe, expect, it } from 'vitest'
import {
  mapVisibilityIdsToChatCatalogIds,
  mapVisibilityToChatCatalogIds,
  type ModelMenuVisibility,
} from '@/lib/ai/modelMenuVisibility'

describe('mapVisibilityToChatCatalogIds', () => {
  it('mapea IDs Vertex a IDs de catálogo de chat', () => {
    const ids = mapVisibilityIdsToChatCatalogIds([
      'gemini-2.5-flash-002',
      'claude-sonnet-4-6@anthropic',
      'deepseek-v3.2-maas',
    ])
    expect(ids.has('gemini-2.5-flash')).toBe(true)
    expect(ids.has('claude-sonnet-4-6')).toBe(true)
    expect(ids.has('deepseek-ai/deepseek-v3.2-maas')).toBe(true)
  })

  it('agrupa buckets admin en un set de chat', () => {
    const visibility: ModelMenuVisibility = {
      language: ['gemini-2.5-flash-002'],
      coding: ['gemini-2.5-flash-002'],
      ocr: ['deepseek-ai/deepseek-ocr-2'],
    }
    const ids = mapVisibilityToChatCatalogIds(visibility)
    expect(ids.size).toBe(2)
    expect(ids.has('gemini-2.5-flash')).toBe(true)
    expect(ids.has('deepseek-ai/deepseek-ocr-2')).toBe(true)
  })
})

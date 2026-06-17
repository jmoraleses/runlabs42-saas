import { describe, expect, it } from 'vitest'
import {
  gemini20FallbackModelId,
  vertexTextFallbackModelId,
  vertexTextProactiveFallbackModelId,
  toVertexModelId,
} from '@/lib/ai/constants'

describe('toVertexModelId', () => {
  it('keeps GA gemini 2.5 ids unchanged', () => {
    expect(toVertexModelId('gemini-2.5-flash')).toBe('gemini-2.5-flash')
    expect(toVertexModelId('gemini-2.5-flash-lite')).toBe('gemini-2.5-flash-lite')
    expect(toVertexModelId('gemini-2.5-pro')).toBe('gemini-2.5-pro')
  })

  it('does not append retired -001 suffix to gemini 2.0', () => {
    expect(toVertexModelId('gemini-2.0-flash')).toBe('gemini-2.0-flash')
    expect(toVertexModelId('gemini-2.0-flash-lite')).toBe('gemini-2.0-flash-lite')
  })

  it('does not map to retired preview model ids', () => {
    const out = toVertexModelId('gemini-2.5-flash')
    expect(out).not.toContain('preview-05-20')
    expect(out).not.toContain('preview-06-05')
  })
})

describe('vertexTextFallbackModelId', () => {
  it('maps 2.0 retirados a 2.5; 3.1 solo para reintento 404', () => {
    expect(vertexTextProactiveFallbackModelId('gemini-2.0-flash')).toBe('gemini-2.5-flash')
    expect(vertexTextFallbackModelId('gemini-3.1-flash-lite')).toBe('gemini-2.5-flash-lite')
    expect(vertexTextProactiveFallbackModelId('gemini-3.1-flash-lite')).toBeUndefined()
    expect(gemini20FallbackModelId('gemini-2.0-flash')).toBe('gemini-2.5-flash')
  })
})

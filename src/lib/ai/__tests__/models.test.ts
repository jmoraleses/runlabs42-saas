import { describe, expect, it } from 'vitest'
import { AUTO_MODEL_ID, MAX_MODEL_ID, resolveModelId } from '@/lib/ai/models'

describe('resolveModelId', () => {
  it('auto picks cheapest enabled text model', () => {
    expect(resolveModelId(AUTO_MODEL_ID, { geminiEnabled: true })).toBe('gemma-3n-e4b-it')
  })

  it('uses explicit enabled model', () => {
    expect(resolveModelId('gemini-2.5-flash-lite', { geminiEnabled: true })).toBe(
      'gemini-2.5-flash-lite',
    )
  })

  it('redirects gemini 2.0 to 2.5 when 2.0 is unavailable on Vertex', () => {
    expect(resolveModelId('gemini-2.0-flash', { geminiEnabled: true })).toBe('gemini-2.5-flash')
  })

  it('resolves google/gemini-2.0-flash-001 and legacy deepseek ids', () => {
    expect(resolveModelId('google/gemini-2.0-flash-001', { geminiEnabled: true })).toBe(
      'google/gemini-2.0-flash-001',
    )
    expect(resolveModelId('deepseek-v3.2-maas', { geminiEnabled: true })).toBe(
      'deepseek-ai/deepseek-v3.2-maas',
    )
  })

  it('falls back when disabled model requested', () => {
    expect(resolveModelId('gemini-1.5-pro', { geminiEnabled: true })).toBe('gemma-3n-e4b-it')
  })

  it('returns mock when gemini off', () => {
    expect(resolveModelId(AUTO_MODEL_ID, { geminiEnabled: false })).toBe('mock-demo')
  })

  it('max resolves to an orchestrated implement model', () => {
    const id = resolveModelId(MAX_MODEL_ID, { geminiEnabled: true })
    expect(['gemini-2.5-flash', 'gemini-2.5-pro', 'claude-opus-4-7']).toContain(id)
  })
})

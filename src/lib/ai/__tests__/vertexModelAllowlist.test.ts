import { describe, expect, it } from 'vitest'
import { IMAGEN3_GEN_MODEL_FAST, IMAGE_GEN_MODEL } from '@/lib/ai/constants'
import {
  isVertexAgentTextModelId,
  isVertexGaCatalogModelId,
  resolveVertexAgentTextModelId,
  resolveVertexImageModelId,
} from '@/lib/ai/vertexModelAllowlist'

describe('vertexModelAllowlist', () => {
  it('acepta modelos de texto GA en Vertex', () => {
    expect(isVertexAgentTextModelId('gemini-2.5-flash')).toBe(true)
    expect(isVertexAgentTextModelId('gemini-3.1-flash-lite')).toBe(true)
    expect(isVertexAgentTextModelId('claude-sonnet-4-6')).toBe(true)
    expect(isVertexAgentTextModelId('composer-2-5-maas')).toBe(true)
    expect(isVertexAgentTextModelId('deepseek-ai/deepseek-v3.2-maas')).toBe(true)
    expect(isVertexAgentTextModelId('deepseek-ai/deepseek-v4-flash')).toBe(true)
    expect(isVertexAgentTextModelId('deepseek-ai/deepseek-ocr-2')).toBe(true)
    expect(isVertexAgentTextModelId('deepseek-ai/deepseek-r1-0528-maas')).toBe(true)
    expect(isVertexAgentTextModelId('llama-4-scout-17b-16e-instruct-maas')).toBe(true)
    expect(isVertexAgentTextModelId('gemini-3.5-flash')).toBe(true)
    expect(isVertexAgentTextModelId('gemini-3.1-pro-preview')).toBe(true)
    expect(isVertexAgentTextModelId('deepseek-v3.2-maas')).toBe(false)
    expect(isVertexAgentTextModelId('google/gemini-2.0-flash-001')).toBe(true)
    expect(isVertexAgentTextModelId('deepseek-v3.1-maas')).toBe(true)
  })

  it('rechaza gemini-2.0-flash-lite deshabilitado en catálogo', () => {
    expect(isVertexAgentTextModelId('gemini-2.0-flash-lite')).toBe(false)
  })

  it('rechaza preview y modelos inexistentes', () => {
    expect(isVertexGaCatalogModelId('gemini-3.1-flash-image-preview')).toBe(false)
    expect(isVertexAgentTextModelId('gemini-2.0-flash')).toBe(false)
    expect(isVertexAgentTextModelId('gpt-4o')).toBe(false)
  })

  it('resuelve texto desconocido al default GA', () => {
    expect(resolveVertexAgentTextModelId('gemini-3.1-pro-preview')).toBe('gemini-3.1-pro-preview')
    expect(resolveVertexAgentTextModelId('gemini-2.0-flash')).toBe('gemini-2.5-flash')
    expect(resolveVertexAgentTextModelId('gemini-3.1-flash-lite')).toBe('gemini-3.1-flash-lite')
    expect(resolveVertexAgentTextModelId('gpt-4o')).toBe('gemini-3.1-flash-lite')
  })

  it('resuelve imagen preview a Imagen 3 Fast por defecto', () => {
    expect(resolveVertexImageModelId('gemini-3.1-flash-image-preview')).toBe(IMAGEN3_GEN_MODEL_FAST)
    expect(resolveVertexImageModelId(undefined)).toBe(IMAGEN3_GEN_MODEL_FAST)
    expect(resolveVertexImageModelId('gemini-2.5-flash-image')).toBe(IMAGE_GEN_MODEL)
    expect(resolveVertexImageModelId('imagen-3.0-fast-generate-001')).toBe(
      'imagen-3.0-fast-generate-001',
    )
    expect(resolveVertexImageModelId('imagen-4.0-fast-generate-001')).toBe(
      'imagen-4.0-fast-generate-001',
    )
  })
})

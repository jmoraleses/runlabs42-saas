import { describe, expect, it } from 'vitest'
import {
  inferModelMenuBuckets,
  isImageComprehensionModel,
  isImageGenerationModel,
} from '@/lib/ai/modelMenuVisibility'

describe('modelMenuVisibility OCR / comprensión de imágenes', () => {
  it('incluye Gemini multimodal en OCR', () => {
    expect(inferModelMenuBuckets('gemini-2.5-flash')).toContain('ocr')
    expect(inferModelMenuBuckets('gemini-2.5-flash')).toContain('language')
  })

  it('excluye modelos de generación de imagen del bucket OCR', () => {
    expect(isImageGenerationModel('imagen-3.0-generate-002', { category: 'image' })).toBe(true)
    expect(inferModelMenuBuckets('imagen-3.0-generate-002', { category: 'image' })).toEqual([])
    expect(inferModelMenuBuckets('gemini-2.5-flash-image', { category: 'image' })).toEqual([])
  })

  it('modelos OCR dedicados solo en bucket OCR', () => {
    expect(inferModelMenuBuckets('deepseek-ai/deepseek-ocr-2')).toEqual(['ocr'])
  })

  it('detecta etiqueta de Vertex en displayName', () => {
    expect(
      isImageComprehensionModel('custom-vision-model', {
        displayName: 'Comprensión de imágenes (preview)',
      }),
    ).toBe(true)
  })

  it('Claude multimodal en OCR y lenguaje', () => {
    const buckets = inferModelMenuBuckets('claude-sonnet-4-6')
    expect(buckets).toContain('ocr')
    expect(buckets).toContain('language')
  })
})

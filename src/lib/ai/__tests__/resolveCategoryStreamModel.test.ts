import { describe, expect, it } from 'vitest'
import { MAX_MODEL_ID } from '@/lib/ai/modelTypes'
import {
  classifyStreamModelTask,
  pickStreamModelForTask,
  resolveStreamModelForRequest,
  shouldRunOcrThenCodePipeline,
} from '@/lib/ai/resolveCategoryStreamModel'

describe('classifyStreamModelTask', () => {
  it('marca OCR con imágenes', () => {
    expect(classifyStreamModelTask({ command: '/plan', hasImages: true })).toBe('ocr')
  })

  it('usa código en /build', () => {
    expect(classifyStreamModelTask({ command: '/build', hasImages: false })).toBe('code')
  })

  it('usa código en /plan sin imágenes', () => {
    expect(classifyStreamModelTask({ command: '/plan', hasImages: false })).toBe('code')
  })
})

describe('resolveStreamModelForRequest', () => {
  const categories = {
    code: 'gpt-oss-20b-maas',
    image: 'deepseek-ai/deepseek-ocr-2',
  }

  it('enruta por categoría en modo custom', () => {
    const build = resolveStreamModelForRequest({
      modelChoice: 'gemini-2.5-flash-lite',
      categoryModels: categories,
      geminiEnabled: true,
      command: '/build',
      hasImages: false,
    })
    expect(build.usesCategoryRouting).toBe(true)
    expect(build.modelId).toBe('gpt-oss-20b-maas')

    const chat = resolveStreamModelForRequest({
      modelChoice: 'gemini-2.5-flash-lite',
      categoryModels: categories,
      geminiEnabled: true,
      command: '/plan',
      hasImages: false,
    })
    expect(chat.modelId).toBe('gpt-oss-20b-maas')

    const withImages = resolveStreamModelForRequest({
      modelChoice: 'gemini-2.5-flash-lite',
      categoryModels: categories,
      geminiEnabled: true,
      command: '/plan',
      hasImages: true,
    })
    expect(withImages.modelId).toBe('gpt-oss-20b-maas')
    expect(withImages.ocrThenCode).toBe(true)
  })

  it('Max con imágenes y pipeline OCR→Code usa modelo código', () => {
    const out = resolveStreamModelForRequest({
      modelChoice: MAX_MODEL_ID,
      categoryModels: categories,
      geminiEnabled: true,
      command: '/build',
      hasImages: true,
    })
    expect(out.ocrThenCode).toBe(true)
    expect(out.modelId).toBe('gpt-oss-20b-maas')
  })
})

describe('pickStreamModelForTask', () => {
  it('respeta el bucket de cada tarea', () => {
    const resolved = {
      code: 'gpt-oss-20b-maas',
      image: 'deepseek-ai/deepseek-ocr-2',
    }
    expect(pickStreamModelForTask('code', resolved, 'fallback')).toBe('gpt-oss-20b-maas')
    expect(pickStreamModelForTask('ocr', resolved, 'fallback')).toBe('deepseek-ai/deepseek-ocr-2')
  })
})

describe('shouldRunOcrThenCodePipeline', () => {
  it('requiere imágenes y modelos distintos', () => {
    expect(
      shouldRunOcrThenCodePipeline(true, {
        code: 'gpt-oss-20b-maas',
        image: 'deepseek-ai/deepseek-ocr-2',
      }),
    ).toBe(true)
    expect(
      shouldRunOcrThenCodePipeline(true, {
        code: 'same-model',
        image: 'same-model',
      }),
    ).toBe(false)
    expect(shouldRunOcrThenCodePipeline(false, { code: 'a', image: 'b' })).toBe(false)
  })
})

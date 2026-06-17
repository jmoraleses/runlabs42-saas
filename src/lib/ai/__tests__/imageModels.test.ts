import { describe, expect, it } from 'vitest'
import {
  IMAGEN3_GEN_MODEL_FAST,
  IMAGE_GEN_MODEL,
} from '@/lib/ai/constants'
import { DEFAULT_DESIGN_IMAGE_MODEL_SETTING } from '@/lib/platform/designImageModelSetting'
import {
  isStableImageModelId,
  listStableImageModels,
  listSelectableImageModelsForClient,
  listStableImageModelsForClient,
  resolveStableImageModelId,
} from '@/lib/ai/imageModels'
import { parseDesignImageModelSetting } from '@/lib/platform/designImageModelSetting'

describe('listStableImageModels', () => {
  it('solo incluye modelos de imagen GA', () => {
    const models = listStableImageModels()
    expect(models.length).toBeGreaterThanOrEqual(3)
    expect(models.every((m) => m.category === 'image' && m.status === 'ga')).toBe(true)
    expect(models.some((m) => m.id === IMAGE_GEN_MODEL)).toBe(true)
    expect(models.some((m) => m.id === 'gemini-3.1-flash-image-preview')).toBe(false)
  })
})

describe('resolveStableImageModelId', () => {
  it('usa Imagen 3 Fast por defecto', () => {
    expect(resolveStableImageModelId(undefined)).toBe(IMAGEN3_GEN_MODEL_FAST)
    expect(resolveStableImageModelId('gemini-3.1-flash-image-preview')).toBe(IMAGEN3_GEN_MODEL_FAST)
    expect(resolveStableImageModelId('gemini-2.5-flash-image')).toBe(IMAGE_GEN_MODEL)
  })

  it('acepta ids estables del catálogo', () => {
    expect(resolveStableImageModelId('imagen-3.0-generate-002')).toBe('imagen-3.0-generate-002')
    expect(resolveStableImageModelId('imagen-4.0-generate-001')).toBe('imagen-4.0-generate-001')
  })
})

describe('DEFAULT_DESIGN_IMAGE_MODEL_SETTING', () => {
  it('prefiere Imagen 3 Fast (GA) frente a Nano Banana con cuota agotada', () => {
    expect(DEFAULT_DESIGN_IMAGE_MODEL_SETTING.modelId).toBe(IMAGEN3_GEN_MODEL_FAST)
  })
})

describe('parseDesignImageModelSetting', () => {
  it('parsea objeto y string', () => {
    expect(parseDesignImageModelSetting({ modelId: 'imagen-4.0-generate-001' }).modelId).toBe(
      'imagen-4.0-generate-001',
    )
    expect(parseDesignImageModelSetting('gemini-2.5-flash-image').modelId).toBe(
      IMAGEN3_GEN_MODEL_FAST,
    )
  })
})

describe('listStableImageModelsForClient', () => {
  it('expone kind nano-banana o imagen', () => {
    const client = listStableImageModelsForClient()
    const nb = client.find((m) => m.id === IMAGE_GEN_MODEL)
    expect(nb?.kind).toBe('nano-banana')
    expect(isStableImageModelId(IMAGE_GEN_MODEL)).toBe(true)
  })
})

describe('listSelectableImageModelsForClient', () => {
  it('solo incluye Imagen GA, ordenados por precio', () => {
    const client = listSelectableImageModelsForClient()
    expect(client.some((m) => m.id === IMAGE_GEN_MODEL)).toBe(false)
    expect(client.every((m) => m.kind === 'imagen')).toBe(true)
    expect(client.length).toBeGreaterThanOrEqual(3)
    const prices = client.map((m) => m.perImage ?? Infinity)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
  })
})

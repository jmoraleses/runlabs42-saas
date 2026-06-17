import { IMAGEN3_GEN_MODEL_FAST } from '@/lib/ai/constants'
import { resolveStableImageModelId } from '@/lib/ai/imageModels'

export const DESIGN_IMAGE_MODEL_SETTING_KEY = 'design_image_model'

/** Modelos sustituidos por Imagen 3 Fast en Vertex Agent Platform. */
export const LEGACY_DESIGN_IMAGE_MODEL_IDS = new Set([
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation',
])

export type DesignImageModelSetting = {
  modelId: string
}

export const DEFAULT_DESIGN_IMAGE_MODEL_SETTING: DesignImageModelSetting = {
  modelId: IMAGEN3_GEN_MODEL_FAST,
}

function normalizeDesignImageModelId(modelId: string): string {
  const resolved = resolveStableImageModelId(modelId)
  if (LEGACY_DESIGN_IMAGE_MODEL_IDS.has(resolved)) {
    return DEFAULT_DESIGN_IMAGE_MODEL_SETTING.modelId
  }
  return resolved
}

export function parseDesignImageModelSetting(value: unknown): DesignImageModelSetting {
  if (typeof value === 'string' && value.trim()) {
    return { modelId: normalizeDesignImageModelId(value) }
  }
  if (value && typeof value === 'object' && 'modelId' in value) {
    const raw = (value as DesignImageModelSetting).modelId
    return { modelId: normalizeDesignImageModelId(typeof raw === 'string' ? raw : '') }
  }
  return { ...DEFAULT_DESIGN_IMAGE_MODEL_SETTING }
}

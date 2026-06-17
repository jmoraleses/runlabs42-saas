export const VERTEX_GEMINI_BATCH_SETTING_KEY = 'vertex_gemini_batch_api'

export type VertexGeminiBatchSetting = {
  enabled: boolean
}

/** Desactivado hasta staging GCS (Vertex Batch no admite peticiones inline). */
export const DEFAULT_VERTEX_GEMINI_BATCH_SETTING: VertexGeminiBatchSetting = {
  enabled: false,
}

export function parseVertexGeminiBatchEnabled(value: unknown): boolean {
  if (value && typeof value === 'object' && 'enabled' in value) {
    return (value as VertexGeminiBatchSetting).enabled === true
  }
  return DEFAULT_VERTEX_GEMINI_BATCH_SETTING.enabled
}

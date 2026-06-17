export const DESIGN_IMAGE_GENERATION_SETTING_KEY = 'design_image_generation'

export type DesignImageGenerationSetting = {
  enabled: boolean
}

/** Activado por defecto: Imagen 4 vía Vertex Agent Platform (modelo configurable en admin). */
export const DEFAULT_DESIGN_IMAGE_GENERATION_SETTING: DesignImageGenerationSetting = {
  enabled: true,
}

export function parseDesignImageGenerationEnabled(value: unknown): boolean {
  if (value && typeof value === 'object' && 'enabled' in value) {
    return (value as DesignImageGenerationSetting).enabled === true
  }
  return DEFAULT_DESIGN_IMAGE_GENERATION_SETTING.enabled
}

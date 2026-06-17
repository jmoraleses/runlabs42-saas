/** Preferencia local del modelo de imagen en Studio / chat de diseño. */
export const DESIGN_IMAGE_MODEL_PREF_KEY = 'spec.design.imageModel'

export function readDesignImageModelPref(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(DESIGN_IMAGE_MODEL_PREF_KEY)?.trim()
    return raw || null
  } catch {
    return null
  }
}

export function writeDesignImageModelPref(modelId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DESIGN_IMAGE_MODEL_PREF_KEY, modelId)
  } catch {
    /* quota / private mode */
  }
}

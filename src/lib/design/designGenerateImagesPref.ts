/** Preferencia del usuario: generar imágenes con Vertex al crear diseño en Studio. */
export const DESIGN_GENERATE_IMAGES_PREF_KEY = 'spec.design.generateImages'

export function readDesignGenerateImagesPref(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = window.localStorage.getItem(DESIGN_GENERATE_IMAGES_PREF_KEY)
    if (stored === null) return false
    return stored === '1'
  } catch {
    return false
  }
}

export function writeDesignGenerateImagesPref(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DESIGN_GENERATE_IMAGES_PREF_KEY, enabled ? '1' : '0')
  } catch {
    /* quota / private mode */
  }
}

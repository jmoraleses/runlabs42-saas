/** Constantes y helpers de modelos — seguros para importar en el cliente. */

export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite'

/**
 * Tope de salida para publishers que exigen max_tokens (p. ej. Anthropic en Vertex).
 * En Gemini/Google no se envía maxOutputTokens si el caller no lo indica — el modelo usa su máximo.
 */
export const VERTEX_DEFAULT_MAX_OUTPUT_TOKENS = 32_000

/** Nano Banana — Gemini 2.5 Flash Image en Vertex AI Agent Platform. */
export const IMAGE_GEN_MODEL = 'gemini-2.5-flash-image'

/** @deprecated Preview no GA en Vertex; no usar en runtime. */
export const IMAGE_GEN_MODEL_HQ = 'gemini-3.1-flash-image-preview'

export const NANO_BANANA_VERTEX_MODELS = [IMAGE_GEN_MODEL] as const

/** Imagen 3 — Model Garden / Vertex AI (recomendado: velocidad y coste). */
export const IMAGEN3_GEN_MODEL = 'imagen-3.0-generate-002'
export const IMAGEN3_GEN_MODEL_FAST = 'imagen-3.0-fast-generate-001'

/** Imagen 4 — mockups de pantalla completa vía Vertex :predict (opcional en admin). */
export const MOCKUP_GEN_MODEL = 'imagen-4.0-generate-001'
export const MOCKUP_GEN_MODEL_FAST = 'imagen-4.0-fast-generate-001'

/** Imagen por defecto para assets HTML y generación general (Imagen 3 Fast). */
export const DEFAULT_IMAGE_GEN_MODEL = IMAGEN3_GEN_MODEL_FAST

export const IMAGEN_VERTEX_MODELS = [
  IMAGEN3_GEN_MODEL_FAST,
  IMAGEN3_GEN_MODEL,
  MOCKUP_GEN_MODEL,
  MOCKUP_GEN_MODEL_FAST,
] as const

export type DesignAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9'

const DESIGN_ASPECT_CANDIDATES: { ar: DesignAspectRatio; ratio: number }[] = [
  { ar: '16:9', ratio: 16 / 9 },
  { ar: '4:3', ratio: 4 / 3 },
  { ar: '1:1', ratio: 1 },
  { ar: '3:4', ratio: 3 / 4 },
  { ar: '9:16', ratio: 9 / 16 },
]

export function normalizeDesignAspectRatio(aspect: string | undefined): DesignAspectRatio {
  const a = aspect?.trim() ?? '16:9'
  if (['1:1', '3:4', '4:3', '9:16', '16:9'].includes(a)) return a as DesignAspectRatio
  return '16:9'
}

/** Elige el aspect ratio de Imagen más cercano al tamaño de página (página completa, no recorte 16:9). */
export function aspectRatioFromPageDimensions(
  width: number,
  height: number,
  fallback?: string,
): DesignAspectRatio {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return normalizeDesignAspectRatio(fallback)
  }
  const target = width / height
  let best = DESIGN_ASPECT_CANDIDATES[0]!
  let bestDiff = Math.abs(target - best.ratio)
  for (const c of DESIGN_ASPECT_CANDIDATES) {
    const diff = Math.abs(target - c.ratio)
    if (diff < bestDiff) {
      best = c
      bestDiff = diff
    }
  }
  return best.ar
}

export function isImagenModelId(modelId: string): boolean {
  return modelId.startsWith('imagen-')
}

/** Etiqueta corta para logs (Imagen 3 / 4). */
export function imagenModelFamilyLabel(modelId: string): string {
  if (modelId.includes('imagen-3')) return 'Imagen 3'
  if (modelId.includes('imagen-4')) return 'Imagen 4'
  return 'Imagen'
}

/**
 * Modelos de texto que a menudo devuelven 404 en Vertex (retirados, preview regional o sin acceso).
 * Si la API falla, se reintenta con el equivalente 2.5 GA.
 */
/** Solo modelos retirados o no GA: redirección proactiva y reintento tras 404. */
export const VERTEX_TEXT_MODEL_FALLBACK: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
}

/** Si Vertex devuelve 404 con un modelo GA reciente, reintento opcional (sin redirigir antes de llamar). */
export const VERTEX_TEXT_MODEL_404_RETRY: Record<string, string> = {
  'gemini-3.1-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-1.5-flash-8b': 'gemini-2.5-flash-lite',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemma-4-31b-it': 'gemini-2.5-flash-lite',
  'gemma-3n-e4b-it': 'gemini-2.5-flash-lite',
  'google/gemini-2.0-flash-001': 'gemini-2.5-flash',
  'gemini-2.0-flash-001': 'gemini-2.5-flash',
}

/** @deprecated Usar VERTEX_TEXT_MODEL_FALLBACK */
export const GEMINI_20_VERTEX_FALLBACK = VERTEX_TEXT_MODEL_FALLBACK

/** IDs Vertex GA — sin sufijo -001 (varía por proyecto y versión). */
export function toVertexModelId(modelId: string): string {
  return modelId
}

export function vertexTextFallbackModelId(modelId: string): string | undefined {
  return VERTEX_TEXT_MODEL_FALLBACK[modelId] ?? VERTEX_TEXT_MODEL_404_RETRY[modelId]
}

/** Fallback proactivo en resolve (solo familia 2.0 retirada). */
export function vertexTextProactiveFallbackModelId(modelId: string): string | undefined {
  return VERTEX_TEXT_MODEL_FALLBACK[modelId]
}

export function gemini20FallbackModelId(modelId: string): string | undefined {
  return vertexTextFallbackModelId(modelId)
}

export function isGemini20Family(modelId: string): boolean {
  return modelId.startsWith('gemini-2.0-')
}

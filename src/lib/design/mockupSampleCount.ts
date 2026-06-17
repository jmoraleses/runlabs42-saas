export const MOCKUP_SAMPLE_COUNT_MIN = 1
export const MOCKUP_SAMPLE_COUNT_MAX = 4

/** Reintentos por modelo Imagen 4 ante 429/5xx. */
export const MOCKUP_GEN_MAX_RETRIES = 3

/** Pausa entre pantallas para no saturar cuota Vertex. */
export const MOCKUP_GEN_DELAY_MS = 1200

export function clampMockupSampleCount(value: unknown): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return MOCKUP_SAMPLE_COUNT_MIN
  return Math.min(MOCKUP_SAMPLE_COUNT_MAX, Math.max(MOCKUP_SAMPLE_COUNT_MIN, n))
}

/** Tipos base de modelos — sin dependencias de catálogo. */

export const AUTO_MODEL_ID = 'auto'

/** Orquestación multi-modelo por fase (Spec-Kit y streams complejos). */
export const MAX_MODEL_ID = 'max'

export type AIModelProvider = 'gemini' | 'anthropic' | 'openai' | 'cursor' | 'deepseek' | 'meta'

export type AIModelOption = {
  id: string
  labelKey: string
  provider: AIModelProvider
  enabled: boolean
  latencyRank: number
  imageGenModel?: string
  supportsThinking?: boolean
  supportsCaching?: boolean
  tier: 'free' | 'paid'
}

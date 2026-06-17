import { AUTO_MODEL_ID, MAX_MODEL_ID, type AIModelOption } from '@/lib/ai/modelTypes'
import { DEFAULT_IMAGE_GEN_MODEL } from '@/lib/ai/constants'
import type { SupportedLang } from '@/lib/locale'

export type ModelCategory = 'text' | 'image' | 'video' | 'embedding'
export type ModelVendor = 'google' | 'anthropic' | 'openai' | 'cursor' | 'deepseek' | 'meta'

/** Multiplicador sobre precio bruto Vertex (1.0 = sin margen). */
export const PRICE_MARGIN = 1.0

export type ModelPricing = {
  /** USD por 1M tokens de entrada. null = no aplica. */
  inputPerM: number | null
  /** USD por 1M tokens de salida. */
  outputPerM: number | null
  /** USD por imagen generada. */
  perImage?: number
  /** USD por segundo de vídeo. */
  perSecondVideo?: number
  /** Cuota gratuita AI Studio / capa free. */
  freeTier?: boolean
  margin?: number
}

export type CatalogModel = AIModelOption & {
  category: ModelCategory
  vendor: ModelVendor
  contextWindow: number
  pricing: ModelPricing
  status: 'ga' | 'preview'
}

/** OpenAI en Vertex Model Garden (MaaS) — publishers/openai. */
export const OPENAI_VERTEX_MODELS: {
  id: string
  available: boolean
  labelKey: string
  pricing: { inputPerM: number; outputPerM: number }
}[] = [
  {
    id: 'gpt-oss-20b-maas',
    available: true,
    labelKey: 'ed.modelGptOss20b',
    pricing: { inputPerM: 0.07, outputPerM: 0.25 },
  },
  {
    id: 'gpt-oss-120b-maas',
    available: true,
    labelKey: 'ed.modelGptOss120b',
    pricing: { inputPerM: 0.09, outputPerM: 0.36 },
  },
]

/** Llama en Vertex Model Garden (MaaS) — publishers/meta. */
export const LLAMA_VERTEX_MODELS: {
  id: string
  available: boolean
  location: string
  labelKey: string
  pricing: { inputPerM: number; outputPerM: number }
  contextWindow: number
  status: 'ga' | 'preview'
}[] = [
  {
    id: 'llama-4-scout-17b-16e-instruct-maas',
    available: true,
    location: 'global',
    labelKey: 'ed.modelLlama4Scout',
    pricing: { inputPerM: 0.25, outputPerM: 0.7 },
    contextWindow: 1_000_000,
    status: 'preview',
  },
  {
    id: 'llama-3.3-70b-instruct-maas',
    available: true,
    location: 'global',
    labelKey: 'ed.modelLlama33_70b',
    pricing: { inputPerM: 0.72, outputPerM: 0.72 },
    contextWindow: 131_072,
    status: 'preview',
  },
  {
    id: 'llama-4-maverick-17b-128e-instruct-maas',
    available: true,
    location: 'global',
    labelKey: 'ed.modelLlama4Maverick',
    pricing: { inputPerM: 0.35, outputPerM: 1.15 },
    contextWindow: 1_000_000,
    status: 'preview',
  },
]

/** Cursor Composer en Vertex Agent Platform (MaaS) — publishers/cursor. */
export const CURSOR_VERTEX_MODELS: { id: string; available: boolean }[] = [
  { id: 'composer-2-5-maas', available: true },
]

/** DeepSeek en Vertex Model Garden (MaaS) — endpoints/openapi/chat/completions. */
export const DEEPSEEK_VERTEX_MODELS: {
  id: string
  available: boolean
  /** Región Vertex (v3.1 solo us-central1; v3.2+ suele usar global). */
  location: string
  /** ID del modelo en el body OpenAI (p. ej. deepseek-ai/deepseek-v3.2-maas). */
  openapiModel: string
  labelKey: string
  pricing: { inputPerM: number; outputPerM: number }
  supportsThinking?: boolean
  contextWindow?: number
}[] = [
  {
    id: 'deepseek-ai/deepseek-v4-flash',
    available: true,
    location: 'global',
    openapiModel: 'deepseek-ai/deepseek-v4-flash',
    labelKey: 'ed.modelDeepSeekV4Flash',
    pricing: { inputPerM: 0.14, outputPerM: 0.28 },
    contextWindow: 1_000_000,
  },
  {
    id: 'deepseek-ai/deepseek-v3.2-maas',
    available: true,
    location: 'global',
    openapiModel: 'deepseek-ai/deepseek-v3.2-maas',
    labelKey: 'ed.modelDeepSeekV32',
    pricing: { inputPerM: 0.56, outputPerM: 1.68 },
    contextWindow: 163_840,
  },
  {
    id: 'deepseek-v3.1-maas',
    available: true,
    location: 'us-central1',
    openapiModel: 'deepseek-ai/deepseek-v3.1-maas',
    labelKey: 'ed.modelDeepSeekV31',
    pricing: { inputPerM: 0.6, outputPerM: 1.7 },
    supportsThinking: true,
    contextWindow: 163_840,
  },
  {
    id: 'deepseek-ai/deepseek-ocr-2',
    available: true,
    location: 'global',
    openapiModel: 'deepseek-ai/deepseek-ocr-2',
    labelKey: 'ed.modelDeepSeekOcr2',
    pricing: { inputPerM: 0.3, outputPerM: 1.2 },
    contextWindow: 8_192,
  },
  {
    id: 'deepseek-ai/deepseek-r1-0528-maas',
    available: true,
    location: 'global',
    openapiModel: 'deepseek-ai/deepseek-r1-0528-maas',
    labelKey: 'ed.modelDeepSeekR1',
    pricing: { inputPerM: 1.35, outputPerM: 5.4 },
    supportsThinking: true,
    contextWindow: 163_840,
  },
]

function googleText(
  partial: Omit<CatalogModel, 'category' | 'vendor' | 'provider'> & {
    provider?: AIModelOption['provider']
  },
): CatalogModel {
  return {
    provider: 'gemini',
    category: 'text',
    vendor: 'google',
    ...partial,
  }
}

/**
 * Catálogo Vertex AI / Agent Platform (precios públicos mayo 2026).
 * Fuente: https://cloud.google.com/vertex-ai/generative-ai/pricing
 */
export const MODEL_CATALOG: CatalogModel[] = [
  {
    id: AUTO_MODEL_ID,
    labelKey: 'ed.modelAuto',
    provider: 'gemini',
    category: 'text',
    vendor: 'google',
    enabled: true,
    latencyRank: 0,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    tier: 'free',
    contextWindow: 0,
    pricing: { inputPerM: null, outputPerM: null, freeTier: true },
    status: 'ga',
  },
  {
    id: MAX_MODEL_ID,
    labelKey: 'ed.modelMax',
    provider: 'gemini',
    category: 'text',
    vendor: 'google',
    enabled: true,
    latencyRank: 0,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    tier: 'free',
    contextWindow: 0,
    pricing: { inputPerM: null, outputPerM: null, freeTier: true },
    status: 'ga',
  },
  googleText({
    id: 'gemini-2.0-flash-lite',
    labelKey: 'ed.modelGemini20FlashLite',
    enabled: false,
    latencyRank: 0,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: false,
    supportsCaching: true,
    tier: 'paid',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 0.075, outputPerM: 0.3 },
    /** Descontinuado en Vertex (jun 2026); usar gemini-2.5-flash-lite. */
    status: 'ga',
  }),
  googleText({
    id: 'gemini-1.5-flash-8b',
    labelKey: 'ed.modelGemini15Flash8b',
    enabled: true,
    latencyRank: 0,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: false,
    supportsCaching: true,
    tier: 'paid',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 0.037, outputPerM: 0.15 },
    status: 'ga',
  }),
  googleText({
    id: 'gemini-2.5-flash-lite',
    labelKey: 'ed.modelFlashLite',
    enabled: true,
    latencyRank: 3,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: false,
    supportsCaching: true,
    tier: 'free',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 0.1, outputPerM: 0.4, freeTier: true },
    status: 'ga',
  }),
  googleText({
    id: 'gemini-3.1-flash-lite',
    labelKey: 'ed.modelGemini31FlashLite',
    enabled: true,
    latencyRank: 1,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: true,
    supportsCaching: true,
    tier: 'paid',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 0.25, outputPerM: 1.5 },
    status: 'ga',
  }),
  googleText({
    id: 'gemini-3-flash-preview',
    labelKey: 'ed.modelGemini3Flash',
    enabled: true,
    latencyRank: 1,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: true,
    supportsCaching: true,
    tier: 'paid',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 0.5, outputPerM: 3.0 },
    status: 'preview',
  }),
  googleText({
    id: 'gemini-3.5-flash',
    labelKey: 'ed.modelGemini35Flash',
    enabled: true,
    latencyRank: 1,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: true,
    supportsCaching: true,
    tier: 'paid',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 1.5, outputPerM: 9.0 },
    status: 'ga',
  }),
  googleText({
    id: 'gemini-3.1-pro-preview',
    labelKey: 'ed.modelGemini31Pro',
    enabled: true,
    latencyRank: 1,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: true,
    supportsCaching: true,
    tier: 'paid',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 2.0, outputPerM: 12.0 },
    status: 'preview',
  }),
  googleText({
    id: 'gemini-1.5-flash',
    labelKey: 'ed.modelGemini15Flash',
    enabled: true,
    latencyRank: 2,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: false,
    supportsCaching: true,
    tier: 'paid',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 0.075, outputPerM: 0.3 },
    status: 'ga',
  }),
  {
    id: 'gemma-4-31b-it',
    labelKey: 'ed.modelGemma431b',
    provider: 'gemini',
    category: 'text',
    vendor: 'google',
    enabled: true,
    latencyRank: 4,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: false,
    supportsCaching: false,
    tier: 'paid',
    contextWindow: 131_072,
    pricing: { inputPerM: 0.2, outputPerM: 0.8 },
    status: 'ga',
  },
  {
    id: 'gemma-3n-e4b-it',
    labelKey: 'ed.modelGemma3nE4b',
    provider: 'gemini',
    category: 'text',
    vendor: 'google',
    enabled: true,
    latencyRank: 4,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: false,
    supportsCaching: false,
    tier: 'paid',
    contextWindow: 8_192,
    pricing: { inputPerM: 0.04, outputPerM: 0.08 },
    status: 'ga',
  },
  googleText({
    id: 'gemini-2.5-flash',
    labelKey: 'ed.modelFlash',
    enabled: true,
    latencyRank: 5,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: true,
    supportsCaching: true,
    tier: 'free',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 0.3, outputPerM: 2.5, freeTier: true },
    status: 'ga',
  }),
  googleText({
    id: 'gemini-2.5-pro',
    labelKey: 'ed.modelPro25',
    enabled: true,
    latencyRank: 6,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: true,
    supportsCaching: true,
    tier: 'free',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 1.25, outputPerM: 10.0, freeTier: true },
    status: 'ga',
  }),
  googleText({
    id: 'google/gemini-2.0-flash-001',
    labelKey: 'ed.modelGemini20Flash001',
    enabled: true,
    latencyRank: 7,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: false,
    supportsCaching: true,
    tier: 'paid',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 0.15, outputPerM: 0.6 },
    status: 'ga',
  }),
  googleText({
    id: 'gemini-2.0-flash',
    labelKey: 'ed.modelGemini20Flash',
    enabled: false,
    latencyRank: 7,
    imageGenModel: DEFAULT_IMAGE_GEN_MODEL,
    supportsThinking: false,
    supportsCaching: true,
    tier: 'paid',
    contextWindow: 1_048_576,
    pricing: { inputPerM: 0.15, outputPerM: 0.6 },
    /** Descontinuado en Vertex; usar google/gemini-2.0-flash-001 o gemini-2.5-flash. */
    status: 'preview',
  }),
  {
    id: 'text-embedding-005',
    labelKey: 'ed.modelEmbedding005',
    provider: 'gemini',
    category: 'embedding',
    vendor: 'google',
    enabled: false,
    latencyRank: 10,
    tier: 'paid',
    contextWindow: 0,
    pricing: { inputPerM: 0.025, outputPerM: null },
    status: 'ga',
  },
  {
    id: 'imagen-3.0-fast-generate-001',
    labelKey: 'ed.modelImagen3Fast',
    provider: 'gemini',
    category: 'image',
    vendor: 'google',
    enabled: true,
    latencyRank: 17,
    tier: 'paid',
    contextWindow: 0,
    pricing: { inputPerM: null, outputPerM: null, perImage: 0.02 },
    status: 'ga',
  },
  {
    id: 'imagen-3.0-generate-002',
    labelKey: 'ed.modelImagen3',
    provider: 'gemini',
    category: 'image',
    vendor: 'google',
    enabled: true,
    latencyRank: 18,
    tier: 'paid',
    contextWindow: 0,
    pricing: { inputPerM: null, outputPerM: null, perImage: 0.04 },
    status: 'ga',
  },
  {
    id: 'imagen-4.0-generate-001',
    labelKey: 'ed.modelImagen4',
    provider: 'gemini',
    category: 'image',
    vendor: 'google',
    enabled: true,
    latencyRank: 20,
    tier: 'paid',
    contextWindow: 0,
    pricing: { inputPerM: null, outputPerM: null, perImage: 0.04 },
    status: 'ga',
  },
  {
    id: 'imagen-4.0-fast-generate-001',
    labelKey: 'ed.modelImagen4Fast',
    provider: 'gemini',
    category: 'image',
    vendor: 'google',
    enabled: true,
    latencyRank: 19,
    tier: 'paid',
    contextWindow: 0,
    pricing: { inputPerM: null, outputPerM: null, perImage: 0.03 },
    status: 'ga',
  },
  {
    id: 'gemini-2.5-flash-image',
    labelKey: 'ed.modelNanoBanana',
    provider: 'gemini',
    category: 'image',
    vendor: 'google',
    enabled: true,
    latencyRank: 21,
    tier: 'paid',
    contextWindow: 0,
    pricing: { inputPerM: null, outputPerM: null, perImage: 0.039 },
    status: 'ga',
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    labelKey: 'ed.modelNanoBanana2',
    provider: 'gemini',
    category: 'image',
    vendor: 'google',
    enabled: false,
    latencyRank: 22,
    tier: 'paid',
    contextWindow: 0,
    pricing: { inputPerM: null, outputPerM: null, perImage: 0.045 },
    status: 'preview',
  },
  {
    id: 'veo-3.0-generate-001',
    labelKey: 'ed.modelVeo3',
    provider: 'gemini',
    category: 'video',
    vendor: 'google',
    enabled: false,
    latencyRank: 30,
    tier: 'paid',
    contextWindow: 0,
    pricing: { inputPerM: null, outputPerM: null, perSecondVideo: 0.5 },
    status: 'ga',
  },
  {
    id: 'veo-2.0-generate-001',
    labelKey: 'ed.modelVeo2',
    provider: 'gemini',
    category: 'video',
    vendor: 'google',
    enabled: false,
    latencyRank: 31,
    tier: 'paid',
    contextWindow: 0,
    pricing: { inputPerM: null, outputPerM: null, perSecondVideo: 0.5 },
    status: 'ga',
  },
  {
    id: 'claude-haiku-4-5',
    labelKey: 'ed.modelClaudeHaiku45',
    provider: 'anthropic',
    category: 'text',
    vendor: 'anthropic',
    enabled: true,
    latencyRank: 42,
    tier: 'paid',
    contextWindow: 200_000,
    pricing: { inputPerM: 1, outputPerM: 5 },
    status: 'ga',
  },
  {
    id: 'claude-sonnet-4-5',
    labelKey: 'ed.modelClaudeSonnet45',
    provider: 'anthropic',
    category: 'text',
    vendor: 'anthropic',
    enabled: true,
    latencyRank: 41,
    tier: 'paid',
    contextWindow: 200_000,
    pricing: { inputPerM: 3, outputPerM: 15 },
    status: 'ga',
  },
  {
    id: 'claude-sonnet-4-6',
    labelKey: 'ed.modelClaudeSonnet46',
    provider: 'anthropic',
    category: 'text',
    vendor: 'anthropic',
    enabled: true,
    latencyRank: 41,
    supportsThinking: false,
    tier: 'paid',
    contextWindow: 200_000,
    pricing: { inputPerM: 3, outputPerM: 15 },
    status: 'ga',
  },
  {
    id: 'claude-opus-4-6',
    labelKey: 'ed.modelClaudeOpus46',
    provider: 'anthropic',
    category: 'text',
    vendor: 'anthropic',
    enabled: true,
    latencyRank: 40,
    tier: 'paid',
    contextWindow: 200_000,
    pricing: { inputPerM: 5, outputPerM: 25 },
    status: 'ga',
  },
  {
    id: 'claude-opus-4-7',
    labelKey: 'ed.modelClaudeOpus47',
    provider: 'anthropic',
    category: 'text',
    vendor: 'anthropic',
    enabled: true,
    latencyRank: 40,
    tier: 'paid',
    contextWindow: 200_000,
    pricing: { inputPerM: 5, outputPerM: 25 },
    status: 'ga',
  },
  ...CURSOR_VERTEX_MODELS.filter((m) => m.available).map(
    (m): CatalogModel => ({
      id: m.id,
      labelKey: 'ed.modelComposer25',
      provider: 'cursor',
      category: 'text',
      vendor: 'cursor',
      enabled: true,
      latencyRank: 38,
      tier: 'paid',
      contextWindow: 200_000,
      pricing: { inputPerM: 0.5, outputPerM: 2.5 },
      status: 'ga',
    }),
  ),
  ...OPENAI_VERTEX_MODELS.filter((m) => m.available).map(
    (m): CatalogModel => ({
      id: m.id,
      labelKey: m.labelKey,
      provider: 'openai',
      category: 'text',
      vendor: 'openai',
      enabled: true,
      latencyRank: 50,
      tier: 'paid',
      contextWindow: 131_072,
      pricing: m.pricing,
      status: 'ga',
    }),
  ),
  ...DEEPSEEK_VERTEX_MODELS.filter((m) => m.available).map(
    (m): CatalogModel => ({
      id: m.id,
      labelKey: m.labelKey,
      provider: 'deepseek',
      category: 'text',
      vendor: 'deepseek',
      enabled: true,
      latencyRank: 44,
      supportsThinking: m.supportsThinking ?? false,
      supportsCaching: true,
      tier: 'paid',
      contextWindow: m.contextWindow ?? 163_840,
      pricing: m.pricing,
      status: 'ga',
    }),
  ),
  ...LLAMA_VERTEX_MODELS.filter((m) => m.available).map(
    (m): CatalogModel => ({
      id: m.id,
      labelKey: m.labelKey,
      provider: 'meta',
      category: 'text',
      vendor: 'meta',
      enabled: true,
      latencyRank: 55,
      supportsCaching: false,
      tier: 'paid',
      contextWindow: m.contextWindow,
      pricing: m.pricing,
      status: m.status,
    }),
  ),
]

/** Suma entrada+salida por 1M tokens; menor = más barato. */
export function modelPriceSortKey(model: Pick<CatalogModel, 'pricing'>): number {
  const { inputPerM, outputPerM } = model.pricing
  if (inputPerM == null && outputPerM == null) return Number.POSITIVE_INFINITY
  return (inputPerM ?? 0) + (outputPerM ?? 0)
}

/** Ordena modelos de texto del chat por precio (barato → caro). */
function applyChatModelPriceRanks(): void {
  const textModels = MODEL_CATALOG.filter(
    (m) =>
      m.category === 'text' &&
      m.enabled &&
      m.id !== AUTO_MODEL_ID &&
      m.id !== MAX_MODEL_ID &&
      (m.status === 'ga' || m.status === 'preview'),
  )
  const sorted = [...textModels].sort((a, b) => modelPriceSortKey(a) - modelPriceSortKey(b))
  sorted.forEach((m, index) => {
    m.latencyRank = index + 1
  })
}
applyChatModelPriceRanks()

export function getCatalogModel(id: string): CatalogModel | undefined {
  return MODEL_CATALOG.find((m) => m.id === id)
}

export function getModelPricing(id: string): ModelPricing | undefined {
  return getCatalogModel(id)?.pricing
}

function applyMargin(value: number, margin: number): number {
  const m = margin > 0 ? margin : 1
  const scaled = value * m
  if (scaled >= 1) return Math.round(scaled * 100) / 100
  if (scaled >= 0.01) return Math.round(scaled * 1000) / 1000
  return Math.round(scaled * 10000) / 10000
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(n < 0.01 ? 4 : n < 1 ? 3 : 2)}`
}

type PriceLabels = {
  free: string
  perM: (inPrice: string, outPrice: string) => string
  perImage: (price: string) => string
  perSecond: (price: string) => string
  freeTierNote: string
}

const PRICE_LABELS: Record<SupportedLang, PriceLabels> = {
  en: {
    free: 'Free',
    perM: (i, o) => `${i} in / ${o} out per 1M tokens`,
    perImage: (p) => `${p} per image`,
    perSecond: (p) => `${p} per second`,
    freeTierNote: 'Free tier available',
  },
  es: {
    free: 'Gratis',
    perM: (i, o) => `${i} entrada / ${o} salida por 1M tokens`,
    perImage: (p) => `${p} por imagen`,
    perSecond: (p) => `${p} por segundo`,
    freeTierNote: 'Capa gratuita disponible',
  },
  fr: {
    free: 'Gratuit',
    perM: (i, o) => `${i} entrée / ${o} sortie par 1M tokens`,
    perImage: (p) => `${p} par image`,
    perSecond: (p) => `${p} par seconde`,
    freeTierNote: 'Offre gratuite disponible',
  },
  de: {
    free: 'Kostenlos',
    perM: (i, o) => `${i} Eingabe / ${o} Ausgabe pro 1M Tokens`,
    perImage: (p) => `${p} pro Bild`,
    perSecond: (p) => `${p} pro Sekunde`,
    freeTierNote: 'Kostenloses Kontingent verfügbar',
  },
  nl: {
    free: 'Gratis',
    perM: (i, o) => `${i} invoer / ${o} uitvoer per 1M tokens`,
    perImage: (p) => `${p} per afbeelding`,
    perSecond: (p) => `${p} per seconde`,
    freeTierNote: 'Gratis tier beschikbaar',
  },
  it: {
    free: 'Gratuito',
    perM: (i, o) => `${i} input / ${o} output per 1M token`,
    perImage: (p) => `${p} per immagine`,
    perSecond: (p) => `${p} al secondo`,
    freeTierNote: 'Piano gratuito disponibile',
  },
}

/** Modelos expuestos en el selector de chat (texto GA/preview habilitado + auto). */
export const CHAT_MODEL_IDS = new Set(
  MODEL_CATALOG.filter(
    (m) =>
      m.enabled &&
      (m.status === 'ga' || m.status === 'preview') &&
      (m.category === 'text' || m.id === AUTO_MODEL_ID || m.id === MAX_MODEL_ID),
  ).map((m) => m.id),
)

export function formatPrice(
  model: Pick<CatalogModel, 'pricing' | 'category'>,
  locale: SupportedLang,
  margin = PRICE_MARGIN,
): string | null {
  const labels = PRICE_LABELS[locale] ?? PRICE_LABELS.en
  const p = model.pricing
  const m = p.margin ?? margin

  if (p.perImage != null) {
    return labels.perImage(fmtUsd(applyMargin(p.perImage, m)))
  }
  if (p.perSecondVideo != null) {
    return labels.perSecond(fmtUsd(applyMargin(p.perSecondVideo, m)))
  }
  if (p.inputPerM == null && p.outputPerM == null) return null

  const inStr =
    p.inputPerM === 0 ? labels.free : p.inputPerM != null ? fmtUsd(applyMargin(p.inputPerM, m)) : '—'
  const outStr =
    p.outputPerM === 0
      ? labels.free
      : p.outputPerM != null
        ? fmtUsd(applyMargin(p.outputPerM, m))
        : '—'

  if (p.inputPerM === 0 && p.outputPerM === 0) return labels.free
  return labels.perM(inStr, outStr)
}

export type ModelPriceDisplay = {
  showFreeBadge: boolean
  priceIn: string | null
  priceOut: string | null
  /** Nota corta: "por 1M tokens", precio por imagen, etc. */
  priceNote: string | null
}

/** Precios estructurados para UI del selector de modelos. */
export function formatModelPriceDisplay(
  t: (key: string) => string,
  model: Pick<CatalogModel, 'pricing' | 'category'>,
  margin = PRICE_MARGIN,
): ModelPriceDisplay {
  const p = model.pricing
  const m = p.margin ?? margin

  if (p.perImage != null) {
    return {
      showFreeBadge: false,
      priceIn: null,
      priceOut: null,
      priceNote: t('ed.pricePerImage').replace('{price}', fmtUsd(applyMargin(p.perImage, m))),
    }
  }
  if (p.perSecondVideo != null) {
    return {
      showFreeBadge: false,
      priceIn: null,
      priceOut: null,
      priceNote: t('ed.pricePerSecond').replace('{price}', fmtUsd(applyMargin(p.perSecondVideo, m))),
    }
  }
  if (p.inputPerM == null && p.outputPerM == null) {
    return {
      showFreeBadge: !!p.freeTier,
      priceIn: null,
      priceOut: null,
      priceNote: null,
    }
  }

  return {
    showFreeBadge: !!p.freeTier,
    priceIn: p.inputPerM != null ? fmtUsd(applyMargin(p.inputPerM, m)) : null,
    priceOut: p.outputPerM != null ? fmtUsd(applyMargin(p.outputPerM, m)) : null,
    priceNote: t('ed.priceUnitPerM'),
  }
}

export function formatPriceFromKeys(
  t: (key: string) => string,
  model: Pick<CatalogModel, 'pricing' | 'category'>,
  margin = PRICE_MARGIN,
): { priceLine: string | null; showFreeBadge: boolean } {
  const p = model.pricing
  const m = p.margin ?? margin

  if (p.perImage != null) {
    return {
      priceLine: t('ed.pricePerImage').replace('{price}', fmtUsd(applyMargin(p.perImage, m))),
      showFreeBadge: false,
    }
  }
  if (p.perSecondVideo != null) {
    return {
      priceLine: t('ed.pricePerSecond').replace('{price}', fmtUsd(applyMargin(p.perSecondVideo, m))),
      showFreeBadge: false,
    }
  }
  if (p.inputPerM == null && p.outputPerM == null) {
    return { priceLine: null, showFreeBadge: !!p.freeTier }
  }

  const inPrice = p.inputPerM != null ? fmtUsd(applyMargin(p.inputPerM, m)) : '—'
  const outPrice = p.outputPerM != null ? fmtUsd(applyMargin(p.outputPerM, m)) : '—'

  return {
    priceLine: t('ed.pricePerM').replace('{in}', inPrice).replace('{out}', outPrice),
    showFreeBadge: !!p.freeTier,
  }
}

/** Etiqueta corta para fase Spec-Kit (p. ej. "flash-lite"). */
export function shortModelLabel(modelId: string): string {
  const id = modelId.replace(/@anthropic$/, '')
  const parts = id.split('-')
  if (parts.includes('flash') && parts.includes('lite')) return 'flash-lite'
  if (parts.includes('flash') && parts.includes('image')) return 'nano-banana'
  if (parts.includes('flash')) return 'flash'
  if (parts.includes('pro')) return 'pro'
  if (id.startsWith('claude-')) return id.replace('claude-', '').split('-').slice(0, 2).join('-')
  if (id.startsWith('composer-')) return 'composer-2.5'
  if (id.startsWith('deepseek-ai/')) return id.replace(/^deepseek-ai\//, '').replace(/-maas$/, '')
  if (id.startsWith('deepseek-')) return id.replace(/-maas$/, '')
  if (id.startsWith('llama-')) return id.replace(/-instruct-maas$/, '').replace(/-maas$/, '')
  return parts.slice(-2).join('-') || id
}

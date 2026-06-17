import { getCatalogModel, PRICE_MARGIN } from '@/lib/ai/catalog'

/** Packs de compra: 15€→100, 40€→250, 80€→500 créditos. */
export const CREDIT_PACKS_EUR = [
  { eur: 15, credits: 100 },
  { eur: 40, credits: 250 },
  { eur: 80, credits: 500 },
] as const

/**
 * € que paga el usuario por crédito (pack 15€/100 — el más conservador para margen).
 * Con 80% de margen, el presupuesto API por crédito es 20% de este valor.
 */
export const EUR_PER_CREDIT_RETAIL = 15 / 100

/** Fracción del valor de compra asignada a coste API (20% → plataforma ~80%). */
export const API_COST_SHARE_OF_CREDIT_VALUE = 0.2

export const USD_TO_EUR =
  Number(process.env.USD_TO_EUR_RATE) > 0
    ? Number(process.env.USD_TO_EUR_RATE)
    : 0.92

export type TokenUsage = {
  inputTokens: number
  outputTokens: number
}

export function emptyTokenUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0 }
}

export function mergeTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  }
}

export function totalTokens(usage: TokenUsage): number {
  return usage.inputTokens + usage.outputTokens
}

/** Coste API en USD según precios del catálogo Vertex (Agent Platform). */
export function usdCostFromUsage(modelId: string, usage: TokenUsage): number {
  const catalog = getCatalogModel(modelId)
  const pricing = catalog?.pricing
  if (!pricing) return 0

  const margin = pricing.margin ?? PRICE_MARGIN
  const inCost =
    ((usage.inputTokens || 0) / 1_000_000) * (pricing.inputPerM ?? 0)
  const outCost =
    ((usage.outputTokens || 0) / 1_000_000) * (pricing.outputPerM ?? 0)

  return (inCost + outCost) * margin
}

/**
 * Créditos a cobrar por uso real de tokens.
 * Convierte USD→EUR y divide por el presupuesto API por crédito (20% de 0,15€).
 */
export function creditsFromTokenUsage(modelId: string, usage: TokenUsage): number {
  const usd = usdCostFromUsage(modelId, usage)
  if (usd <= 0) return 0

  const eur = usd / USD_TO_EUR
  const apiBudgetPerCreditEur = EUR_PER_CREDIT_RETAIL * API_COST_SHARE_OF_CREDIT_VALUE
  const credits = eur / apiBudgetPerCreditEur
  return Math.round(credits * 10) / 10
}

/** Estimación rápida de tokens (~4 caracteres por token). */
export function estimateTokensFromText(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function estimateCreditsForRequest(opts: {
  modelId: string
  prompt: string
  contextChars?: number
  maxOutputTokens?: number
  pipelinePhases?: number
  imageCount?: number
}): number {
  const phases = opts.pipelinePhases ?? 1
  const inputEst = estimateTokensFromText(
    `${opts.prompt ?? ''}${opts.contextChars ?? 0}`,
  )
  const outputEst = opts.maxOutputTokens ?? 4096
  const perPhase = creditsFromTokenUsage(opts.modelId, {
    inputTokens: inputEst,
    outputTokens: outputEst,
  })
  const imageExtra = (opts.imageCount ?? 0) > 0 ? 0.5 * (opts.imageCount ?? 0) : 0
  return Math.round((perPhase * phases + imageExtra) * 10) / 10
}

/** Créditos enteros a descontar en Supabase (mínimo 1 si hubo uso). */
export function billableCreditAmount(computedCredits: number): number {
  if (computedCredits <= 0) return 0
  return Math.max(1, Math.ceil(computedCredits))
}

export type StreamCostPayload = {
  credits: number
  billableCredits: number
  inputTokens: number
  outputTokens: number
  usdCost: number
  model: string
  modelChoice?: string
  provider?: string
  command?: string
}

export function buildStreamCostPayload(opts: {
  modelId: string
  modelChoice?: string
  usage: TokenUsage
  imageCount?: number
  provider?: string
  command?: string
}): StreamCostPayload {
  const imageExtra =
    (opts.imageCount ?? 0) > 0 ? Math.round(0.5 * (opts.imageCount ?? 0) * 10) / 10 : 0
  const base = creditsFromTokenUsage(opts.modelId, opts.usage)
  const credits = Math.round((base + imageExtra) * 10) / 10
  return {
    credits,
    billableCredits: billableCreditAmount(credits),
    inputTokens: opts.usage.inputTokens,
    outputTokens: opts.usage.outputTokens,
    usdCost: usdCostFromUsage(opts.modelId, opts.usage),
    model: opts.modelId,
    modelChoice: opts.modelChoice,
    provider: opts.provider,
    command: opts.command,
  }
}

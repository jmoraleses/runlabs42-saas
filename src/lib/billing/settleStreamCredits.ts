import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/errors'
import {
  billableCreditAmount,
  buildStreamCostPayload,
  emptyTokenUsage,
  estimateCreditsForRequest,
  totalTokens,
  type StreamCostPayload,
  type TokenUsage,
} from '@/lib/billing/tokenCredits'

export async function fetchUserCredits(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('users')
    .select('credits')
    .eq('id', userId)
    .single()
  if (error) return 0
  return data?.credits ?? 0
}

export function estimateStreamCredits(opts: {
  modelId: string
  prompt: string
  contextChars: number
  useSpecKitPipeline: boolean
  imageCount: number
}): number {
  const phases = opts.useSpecKitPipeline ? 5 : 1
  return estimateCreditsForRequest({
    modelId: opts.modelId,
    prompt: opts.prompt,
    contextChars: opts.contextChars,
    pipelinePhases: phases,
    imageCount: opts.imageCount,
  })
}

/** Comprueba saldo antes del stream (estimación conservadora). */
export async function assertSufficientCreditsForStream(opts: {
  supabase: SupabaseClient
  userId: string
  modelId: string
  prompt: string
  contextChars: number
  useSpecKitPipeline: boolean
  imageCount: number
}): Promise<void> {
  const estimated = estimateStreamCredits(opts)
  const required = billableCreditAmount(Math.max(estimated * 0.5, 0.1))
  const balance = await fetchUserCredits(opts.supabase, opts.userId)
  if (balance < required) {
    throw new ApiError(402, 'Créditos insuficientes')
  }
}

export async function settleStreamCredits(opts: {
  supabase: SupabaseClient | null
  userId: string
  skipCredits: boolean
  modelId: string
  modelChoice: string
  usage: TokenUsage
  imageCount: number
  command: string
  provider: string
  description: string
}): Promise<StreamCostPayload> {
  const usage =
    opts.usage.inputTokens > 0 || opts.usage.outputTokens > 0
      ? opts.usage
      : emptyTokenUsage()

  const cost = buildStreamCostPayload({
    modelId: opts.modelId,
    modelChoice: opts.modelChoice,
    usage,
    imageCount: opts.imageCount,
    provider: opts.provider,
    command: opts.command,
  })

  if (!opts.skipCredits && opts.supabase && cost.billableCredits > 0) {
    const { data: ok, error } = await opts.supabase.rpc('deducir_creditos', {
      p_user_id: opts.userId,
      p_amount: cost.billableCredits,
      p_model: opts.modelId,
      p_tokens: totalTokens(usage),
      p_description: opts.description,
    })
    if (error) console.warn('deducir_creditos:', error.message)
    if (ok === false) console.warn('deducir_creditos: saldo insuficiente tras stream')
  }

  return cost
}

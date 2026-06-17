import type { TokenUsage } from '@/lib/billing/tokenCredits'
import { emptyTokenUsage } from '@/lib/billing/tokenCredits'

type GeminiUsageMeta = {
  promptTokenCount?: number
  candidatesTokenCount?: number
  totalTokenCount?: number
}

/** Toma el usage más reciente de un chunk Gemini (acumulado en el último chunk). */
export function usageFromGeminiChunk(chunk: unknown): TokenUsage | null {
  const meta = (chunk as { usageMetadata?: GeminiUsageMeta })?.usageMetadata
  if (!meta) return null

  const input = meta.promptTokenCount ?? 0
  const output = meta.candidatesTokenCount ?? 0
  if (input <= 0 && output <= 0 && !meta.totalTokenCount) return null

  return {
    inputTokens: input,
    outputTokens: output > 0 ? output : Math.max(0, (meta.totalTokenCount ?? 0) - input),
  }
}

export function usageFromGeminiResponseText(responseText: string): TokenUsage {
  let usage = emptyTokenUsage()
  try {
    const chunks = JSON.parse(responseText) as unknown[]
    if (!Array.isArray(chunks)) return usage
    for (const chunk of chunks) {
      const u = usageFromGeminiChunk(chunk)
      if (u) usage = u
    }
  } catch {
    /* respuesta no JSON (texto plano) */
  }
  return usage
}

export function usageFromAnthropicSsePayload(data: {
  type?: string
  message?: { usage?: { input_tokens?: number; output_tokens?: number } }
  usage?: { input_tokens?: number; output_tokens?: number }
}): TokenUsage | null {
  const usage = data.message?.usage ?? data.usage
  if (!usage) return null

  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  if (input <= 0 && output <= 0) return null

  return { inputTokens: input, outputTokens: output }
}

export function usageFromAnthropicJson(json: {
  usage?: { input_tokens?: number; output_tokens?: number }
}): TokenUsage {
  const u = json.usage
  if (!u) return emptyTokenUsage()
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
  }
}

/** Vertex OpenAPI chat/completions (DeepSeek MaaS, etc.). */
export function usageFromOpenAiChatChunk(data: {
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}): TokenUsage | null {
  const usage = data.usage
  if (!usage) return null

  const input = usage.prompt_tokens ?? 0
  const output = usage.completion_tokens ?? 0
  if (input <= 0 && output <= 0) return null

  return { inputTokens: input, outputTokens: output }
}

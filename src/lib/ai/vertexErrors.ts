import { ApiError } from '@/lib/api/errors'

/** Modelo Google usado cuando Vertex devuelve 429 de cuota en Anthropic/OpenAI MaaS. */
export const VERTEX_QUOTA_FALLBACK_MODEL_ID = 'gemini-2.5-flash'

export function isVertexQuotaExceededError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message
  return (
    /Vertex Agent Platform.*error 429/i.test(msg) ||
    /RESOURCE_EXHAUSTED/i.test(msg) ||
    /Quota exceeded/i.test(msg)
  )
}

/** Extrae el id de modelo Vertex del mensaje de error (p. ej. anthropic-claude-haiku-4-5). */
export function vertexQuotaModelFromError(err: unknown): string | null {
  if (!(err instanceof Error)) return null
  const m = err.message.match(/base model:\s*([^\s."',]+)/i)
  return m?.[1] ?? null
}

export function vertexQuotaUserMessage(err: unknown): string {
  const model = vertexQuotaModelFromError(err)
  const label = model?.includes('haiku')
    ? 'Claude Haiku'
    : model?.includes('sonnet')
      ? 'Claude Sonnet'
      : model?.includes('opus')
        ? 'Claude Opus'
        : model
          ? model
          : 'el modelo de IA'
  return `Cuota de Vertex AI agotada para ${label}. Elige Gemini en el selector o solicita más cuota en Google Cloud.`
}

export function apiErrorFromVertexError(error: unknown): ApiError | null {
  if (!isVertexQuotaExceededError(error)) return null
  return new ApiError(429, vertexQuotaUserMessage(error))
}

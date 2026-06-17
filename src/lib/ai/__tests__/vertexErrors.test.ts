import { describe, expect, it } from 'vitest'
import {
  apiErrorFromVertexError,
  isVertexQuotaExceededError,
  vertexQuotaModelFromError,
  vertexQuotaUserMessage,
} from '@/lib/ai/vertexErrors'

const SAMPLE =
  'Vertex Agent Platform (Anthropic) error 429: [{"error":{"message":"Quota exceeded for aiplatform.googleapis.com/global_online_prediction_requests_per_base_model with base model: anthropic-claude-haiku-4-5","status":"RESOURCE_EXHAUSTED"}}]'

describe('vertexErrors', () => {
  it('detects Vertex quota 429', () => {
    expect(isVertexQuotaExceededError(new Error(SAMPLE))).toBe(true)
    expect(isVertexQuotaExceededError(new Error('other'))).toBe(false)
  })

  it('extracts base model from error text', () => {
    expect(vertexQuotaModelFromError(new Error(SAMPLE))).toBe('anthropic-claude-haiku-4-5')
  })

  it('builds user-facing quota message', () => {
    expect(vertexQuotaUserMessage(new Error(SAMPLE))).toContain('Claude Haiku')
    expect(vertexQuotaUserMessage(new Error(SAMPLE))).toContain('Gemini')
  })

  it('maps to ApiError 429', () => {
    const err = apiErrorFromVertexError(new Error(SAMPLE))
    expect(err?.status).toBe(429)
    expect(err?.message).toMatch(/Cuota de Vertex AI/)
  })
})

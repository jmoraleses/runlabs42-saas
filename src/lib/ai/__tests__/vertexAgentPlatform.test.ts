import { describe, expect, it } from 'vitest'
import {
  resolveVertexApiModelId,
  resolveVertexModelRoute,
  resolveVertexPublisher,
} from '@/lib/ai/vertexAgentPlatform'

describe('resolveVertexModelRoute', () => {
  it('routes Gemini to google streamGenerateContent', () => {
    const route = resolveVertexModelRoute('gemini-2.5-flash')
    expect(route.publisher).toBe('google')
    expect(route.method).toBe('streamGenerateContent')
    expect(route.apiModelId).toBe('gemini-2.5-flash')
  })

  it('routes Gemini 3.1 Flash-Lite a endpoint global de Vertex', () => {
    const route = resolveVertexModelRoute('gemini-3.1-flash-lite')
    expect(route.publisher).toBe('google')
    expect(route.apiModelId).toBe('gemini-3.1-flash-lite')
    expect(route.location).toBe('global')
  })

  it('routes Claude to anthropic streamRawPredict on global', () => {
    const route = resolveVertexModelRoute('claude-sonnet-4-6')
    expect(route.publisher).toBe('anthropic')
    expect(route.method).toBe('streamRawPredict')
    expect(route.apiModelId).toBe('claude-sonnet-4-6')
    expect(route.location).toBe('global')
  })

  it('maps legacy @anthropic suffix', () => {
    expect(resolveVertexApiModelId('claude-opus-4-7@anthropic')).toBe('claude-opus-4-7')
    expect(resolveVertexPublisher('claude-opus-4-7@anthropic')).toBe('anthropic')
  })

  it('routes OpenAI MaaS to openai publisher', () => {
    const route = resolveVertexModelRoute('gpt-oss-120b-maas')
    expect(route.publisher).toBe('openai')
    expect(route.method).toBe('streamGenerateContent')
    expect(route.apiModelId).toBe('gpt-oss-120b-maas')
  })

  it('routes Cursor Composer 2.5 MaaS to cursor publisher on global', () => {
    const route = resolveVertexModelRoute('composer-2-5-maas')
    expect(route.publisher).toBe('cursor')
    expect(route.method).toBe('streamGenerateContent')
    expect(route.apiModelId).toBe('composer-2-5-maas')
    expect(route.location).toBe('global')
    expect(resolveVertexPublisher('composer-2-5-maas')).toBe('cursor')
  })

  it('routes DeepSeek V3.2 MaaS to OpenAPI chat completions on global', () => {
    const route = resolveVertexModelRoute('deepseek-ai/deepseek-v3.2-maas')
    expect(route.publisher).toBe('deepseek')
    expect(route.method).toBe('openApiChatCompletions')
    expect(route.apiModelId).toBe('deepseek-ai/deepseek-v3.2-maas')
    expect(route.location).toBe('global')
    expect(resolveVertexPublisher('deepseek-ai/deepseek-v3.2-maas')).toBe('deepseek')
  })

  it('maps legacy deepseek-v3.2-maas id to OpenAPI model', () => {
    expect(resolveVertexApiModelId('deepseek-v3.2-maas')).toBe('deepseek-ai/deepseek-v3.2-maas')
  })

  it('routes google/gemini-2.0-flash-001 to Vertex API id gemini-2.0-flash-001', () => {
    const route = resolveVertexModelRoute('google/gemini-2.0-flash-001')
    expect(route.publisher).toBe('google')
    expect(route.apiModelId).toBe('gemini-2.0-flash-001')
    expect(resolveVertexApiModelId('google/gemini-2.0-flash-001')).toBe('gemini-2.0-flash-001')
  })

  it('routes Llama 4 Scout MaaS to meta publisher on global', () => {
    const route = resolveVertexModelRoute('llama-4-scout-17b-16e-instruct-maas')
    expect(route.publisher).toBe('meta')
    expect(route.apiModelId).toBe('llama-4-scout-17b-16e-instruct-maas')
    expect(route.location).toBe('global')
    expect(resolveVertexPublisher('llama-4-scout-17b-16e-instruct-maas')).toBe('meta')
  })

  it('routes DeepSeek V4 Flash and OCR 2 on global OpenAPI', () => {
    const v4 = resolveVertexModelRoute('deepseek-ai/deepseek-v4-flash')
    expect(v4.publisher).toBe('deepseek')
    expect(v4.apiModelId).toBe('deepseek-ai/deepseek-v4-flash')
    expect(v4.location).toBe('global')

    const ocr = resolveVertexModelRoute('deepseek-ai/deepseek-ocr-2')
    expect(ocr.publisher).toBe('deepseek')
    expect(ocr.apiModelId).toBe('deepseek-ai/deepseek-ocr-2')
    expect(ocr.location).toBe('global')
  })

  it('routes DeepSeek V3.1 MaaS to OpenAPI chat completions on us-central1', () => {
    const route = resolveVertexModelRoute('deepseek-v3.1-maas')
    expect(route.publisher).toBe('deepseek')
    expect(route.method).toBe('openApiChatCompletions')
    expect(route.apiModelId).toBe('deepseek-ai/deepseek-v3.1-maas')
    expect(route.location).toBe('us-central1')
  })

  it('routes Nano Banana image model to google publisher', () => {
    const route = resolveVertexModelRoute('gemini-2.5-flash-image')
    expect(route.publisher).toBe('google')
    expect(route.apiModelId).toBe('gemini-2.5-flash-image')
    expect(resolveVertexPublisher('gemini-2.5-flash-image')).toBe('google')
  })
})

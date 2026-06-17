/**
 * Vertex AI Agent Platform — enrutamiento unificado para todos los publishers
 * (google, anthropic, openai, …) vía publishers/{publisher}/models/{id}.
 *
 * @see https://cloud.google.com/vertex-ai/docs/reference/rest/v1/projects.locations.publishers.models
 */

import type { TokenUsage } from '@/lib/billing/tokenCredits'
import { emptyTokenUsage } from '@/lib/billing/tokenCredits'
import {
  usageFromAnthropicJson,
  usageFromAnthropicSsePayload,
  usageFromGeminiChunk,
  usageFromGeminiResponseText,
  usageFromOpenAiChatChunk,
} from '@/lib/billing/tokenUsage'
import { getVertexAICredentials, getVertexAICredentialsAsync } from '@/lib/ai/config.server'
import { getGoogleCloudAccessToken } from '@/lib/platform/googleCloudCredentials.server'
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_IMAGE_GEN_MODEL,
  vertexTextFallbackModelId,
  isImagenModelId,
  normalizeDesignAspectRatio,
  toVertexModelId,
  VERTEX_DEFAULT_MAX_OUTPUT_TOKENS,
} from '@/lib/ai/constants'
import { DEEPSEEK_VERTEX_MODELS, getCatalogModel } from '@/lib/ai/catalog'
import { MAX_CHAT_IMAGES } from '@/lib/chat/imageAttachments'
import {
  isVertexQuotaExceededError,
  VERTEX_QUOTA_FALLBACK_MODEL_ID,
} from '@/lib/ai/vertexErrors'

export type VertexImagePart = {
  mimeType: string
  data: string
}

/** Gemini: sin maxOutputTokens en el body salvo que el caller lo pase explícitamente. */
function googleGenerationConfig(
  maxOutputTokens: number | undefined,
  base: Record<string, unknown> = {},
): Record<string, unknown> {
  const config = { ...base }
  if (maxOutputTokens != null) {
    config.maxOutputTokens = maxOutputTokens
  }
  return config
}

/** Anthropic en Vertex exige max_tokens en cada petición. */
function anthropicMaxOutputTokens(explicit?: number): number {
  return explicit ?? VERTEX_DEFAULT_MAX_OUTPUT_TOKENS
}

function buildVertexUserParts(
  prompt: string,
  images?: VertexImagePart[],
): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = []
  const imgs = (images ?? []).slice(0, MAX_CHAT_IMAGES)
  if (imgs.length) {
    parts.push({
      text: 'REFERENCIA VISUAL ADJUNTA (obligatoria): analiza la(s) imagen(es) siguientes antes de responder. Extrae colores hex, tipografías, layout y copy visibles; no uses plantillas genéricas del sistema.',
    })
    for (const img of imgs) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data.replace(/^data:[^;]+;base64,/, ''),
        },
      })
    }
  }
  parts.push({ text: prompt })
  return parts
}

export type { TokenUsage }

export type AgentPlatformStreamResult = {
  text: string
  usage: TokenUsage
}

/** OAuth2 Bearer para Vertex AI Agent Platform. */
export async function getVertexBearerToken(): Promise<string> {
  const creds = (await getVertexAICredentialsAsync()) ?? getVertexAICredentials()
  if (!creds) throw new Error('No hay credenciales de Google Cloud configuradas')
  return getGoogleCloudAccessToken(creds)
}

export type VertexPublisher = 'google' | 'anthropic' | 'openai' | 'cursor' | 'deepseek' | 'meta'

export type VertexStreamMethod =
  | 'streamGenerateContent'
  | 'streamRawPredict'
  | 'openApiChatCompletions'

/** Métodos REST de Vertex (streaming y síncrono). */
export type VertexApiMethod = VertexStreamMethod | 'generateContent'

export type VertexModelRoute = {
  publisher: VertexPublisher
  /** ID del modelo en la URL de Vertex o body OpenAI (p. ej. deepseek-ai/deepseek-v3.2-maas). */
  apiModelId: string
  method: VertexStreamMethod
  /** Región Vertex; partners suelen usar `global`. */
  location: string
}

const ANTHROPIC_VERSION = 'vertex-2023-10-16'

/** Alias de catálogo → ID API en Vertex. */
const VERTEX_API_MODEL_ALIASES: Record<string, string> = {
  'claude-opus-4-7@anthropic': 'claude-opus-4-7',
  'claude-sonnet-4-6@anthropic': 'claude-sonnet-4-6',
  'claude-haiku-4-5@anthropic': 'claude-haiku-4-5',
  'google/gemini-2.0-flash-001': 'gemini-2.0-flash-001',
  'deepseek-v3.2-maas': 'deepseek-ai/deepseek-v3.2-maas',
}

function defaultGoogleLocation(): string {
  return getVertexAICredentials()?.location ?? 'us-central1'
}

/**
 * Gemini 3.x (p. ej. gemini-3.1-flash-lite) en Vertex solo en endpoint `global`.
 * Con us-central1 suele devolver 404 y el runtime cae a gemini-2.5-flash-lite.
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/start/get-started-with-gemini-3
 */
export function googleVertexLocationForModel(modelId: string): string {
  const id = modelId.trim()
  if (/^gemini-3(\.|$|-)/i.test(id)) {
    return process.env.VERTEX_GEMINI_3_LOCATION?.trim() || 'global'
  }
  return defaultGoogleLocation()
}

function partnerLocation(): string {
  return (
    process.env.VERTEX_PARTNER_LOCATION?.trim() ??
    process.env.GOOGLE_CLOUD_PARTNER_LOCATION?.trim() ??
    'global'
  )
}

function normalizeDeepseekCatalogModelId(modelId: string): string {
  if (modelId === 'deepseek-v3.2-maas') return 'deepseek-ai/deepseek-v3.2-maas'
  return modelId
}

function findDeepseekVertexModel(modelId: string) {
  const normalized = normalizeDeepseekCatalogModelId(modelId)
  return DEEPSEEK_VERTEX_MODELS.find(
    (m) => m.id === normalized || m.openapiModel === normalized,
  )
}

function deepseekOpenApiModel(modelId: string): string | undefined {
  return findDeepseekVertexModel(modelId)?.openapiModel
}

function deepseekVertexLocation(modelId: string): string {
  return findDeepseekVertexModel(modelId)?.location ?? partnerLocation()
}

export function resolveVertexPublisher(modelId: string): VertexPublisher {
  const catalog = getCatalogModel(modelId)
  if (catalog?.vendor === 'anthropic' || modelId.includes('@anthropic')) return 'anthropic'
  if (catalog?.vendor === 'cursor' || modelId.startsWith('composer-')) return 'cursor'
  if (catalog?.vendor === 'openai' || modelId.startsWith('gpt-oss')) return 'openai'
  if (catalog?.vendor === 'meta' || modelId.startsWith('llama-')) return 'meta'
  if (
    catalog?.vendor === 'deepseek' ||
    modelId.startsWith('deepseek-') ||
    modelId.startsWith('deepseek-ai/')
  ) {
    return 'deepseek'
  }
  return 'google'
}

export function resolveVertexApiModelId(modelId: string): string {
  const alias = VERTEX_API_MODEL_ALIASES[modelId]
  if (alias) return alias
  if (modelId.startsWith('google/')) return modelId.slice('google/'.length)
  if (modelId.endsWith('@anthropic')) return modelId.replace(/@anthropic$/, '')
  if (resolveVertexPublisher(modelId) === 'google') return toVertexModelId(modelId)
  const deepseek = findDeepseekVertexModel(modelId)
  if (deepseek) return deepseek.openapiModel
  return modelId
}

export function resolveVertexModelRoute(modelId: string): VertexModelRoute {
  const publisher = resolveVertexPublisher(modelId)
  const apiModelId = resolveVertexApiModelId(modelId)

  if (publisher === 'anthropic') {
    return {
      publisher,
      apiModelId,
      method: 'streamRawPredict',
      location: partnerLocation(),
    }
  }

  if (publisher === 'openai' || publisher === 'cursor' || publisher === 'meta') {
    return {
      publisher,
      apiModelId,
      method: 'streamGenerateContent',
      location: publisher === 'meta' ? partnerLocation() : partnerLocation(),
    }
  }

  if (publisher === 'deepseek') {
    const openapiModel = deepseekOpenApiModel(modelId) ?? `deepseek-ai/${apiModelId}`
    return {
      publisher,
      apiModelId: openapiModel,
      method: 'openApiChatCompletions',
      location: deepseekVertexLocation(modelId),
    }
  }

  return {
    publisher: 'google',
    apiModelId,
    method: 'streamGenerateContent',
    location: googleVertexLocationForModel(modelId),
  }
}

export function buildVertexPublisherUrl(
  route: VertexModelRoute,
  method: VertexApiMethod,
): string {
  const creds = getVertexAICredentials()
  if (!creds) throw new Error('Vertex AI no configurado')

  const { projectId } = creds
  const { location, publisher, apiModelId } = route
  const host =
    location === 'global'
      ? 'aiplatform.googleapis.com'
      : `${location}-aiplatform.googleapis.com`

  return `https://${host}/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models/${apiModelId}:${method}`
}

/** DeepSeek MaaS y otros open models con API OpenAI en Vertex. */
export function buildVertexOpenApiChatUrl(location: string): string {
  const creds = getVertexAICredentials()
  if (!creds) throw new Error('Vertex AI no configurado')

  const host =
    location === 'global'
      ? 'aiplatform.googleapis.com'
      : `${location}-aiplatform.googleapis.com`

  return `https://${host}/v1/projects/${creds.projectId}/locations/${location}/endpoints/openapi/chat/completions`
}

function openApiMaxOutputTokens(explicit?: number): number {
  return explicit ?? VERTEX_DEFAULT_MAX_OUTPUT_TOKENS
}

function buildOpenApiChatMessages(
  prompt: string,
  systemInstruction?: string,
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = []
  if (systemInstruction?.trim()) {
    messages.push({ role: 'system', content: systemInstruction.trim() })
  }
  messages.push({ role: 'user', content: prompt })
  return messages
}

export type AgentPlatformStreamOpts = {
  prompt: string
  systemInstruction: string
  modelId: string
  thinkingLevel?: string
  maxOutputTokens?: number
  /** Imágenes inline (solo publishers Google / Gemini). */
  images?: VertexImagePart[]
  /** Nombre del recurso Vertex `cachedContents/…` (context cache). */
  cachedContent?: string | null
  /** Fuerza JSON válido (Gemini en Vertex). */
  responseMimeType?: string
  onToken: (text: string) => void
}

function isVertexModelNotFound(status: number, body: string): boolean {
  return status === 404 || /NOT_FOUND|was not found/i.test(body)
}

/** Reintentos ante 429/503 en generateContent y streaming (diseño hace muchas llamadas seguidas). */
const VERTEX_TEXT_MAX_RETRIES = 3
const VERTEX_TEXT_RETRY_BASE_MS = 2000

function isRetryableVertexTextFallback(err: Error, modelId: string): boolean {
  return /error 404/i.test(err.message) && Boolean(vertexTextFallbackModelId(modelId))
}

function vertexTextHttpStatus(err: Error): number | undefined {
  const m = err.message.match(/error (\d{3})\b/i)
  return m ? Number.parseInt(m[1]!, 10) : undefined
}

function isRetryableVertexRateLimitError(err: Error): boolean {
  if (isVertexQuotaExceededError(err)) return true
  const status = vertexTextHttpStatus(err)
  return status === 429 || status === 503 || status === 500
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function vertexModelAttemptIds(modelId: string): string[] {
  const fallback = vertexTextFallbackModelId(modelId)
  const ids = fallback ? [modelId, fallback] : [modelId]
  return [...new Set(ids)]
}

/** Modelos Gemini más ligeros si el elegido devuelve cuota agotada (429). */
function vertexQuotaFallbackGoogleModelIds(modelId: string): string[] {
  const candidates = ['gemini-2.5-flash-lite', VERTEX_QUOTA_FALLBACK_MODEL_ID]
  return candidates.filter(
    (id) => id !== modelId && resolveVertexPublisher(id) === 'google',
  )
}

function vertexGenerateModelAttemptOrder(primaryModelId: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of [
    ...vertexModelAttemptIds(primaryModelId),
    ...vertexQuotaFallbackGoogleModelIds(primaryModelId),
  ]) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function shouldFallbackFromVertexQuota(modelId: string, err: Error): boolean {
  if (!isVertexQuotaExceededError(err)) return false
  if (resolveVertexPublisher(modelId) !== 'google') return true
  return vertexQuotaFallbackGoogleModelIds(modelId).length > 0
}

function vertexQuotaFallbackTargetModel(modelId: string): string {
  if (resolveVertexPublisher(modelId) === 'google') {
    return vertexQuotaFallbackGoogleModelIds(modelId)[0] ?? VERTEX_QUOTA_FALLBACK_MODEL_ID
  }
  return VERTEX_QUOTA_FALLBACK_MODEL_ID
}

/** Streaming unificado Agent Platform (Google Gemini, Anthropic Claude, OpenAI MaaS). */
export async function streamAgentPlatformText(
  opts: AgentPlatformStreamOpts,
): Promise<AgentPlatformStreamResult> {
  const route = resolveVertexModelRoute(opts.modelId)
  const token = await getVertexBearerToken()

  if (route.method === 'openApiChatCompletions') {
    const url = buildVertexOpenApiChatUrl(route.location)
    try {
      return await streamOpenApiChatCompletions(url, token, opts, route.apiModelId)
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      if (shouldFallbackFromVertexQuota(opts.modelId, err)) {
        const fb = vertexQuotaFallbackTargetModel(opts.modelId)
        console.warn(`[vertex] cuota 429 en ${opts.modelId}; reintentando con ${fb}`)
        return streamGoogleFormatGenerate(token, { ...opts, modelId: fb })
      }
      throw err
    }
  }

  if (route.method === 'streamRawPredict') {
    const url = buildVertexPublisherUrl(route, route.method)
    try {
      return await streamAnthropicRawPredict(url, token, opts)
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      if (shouldFallbackFromVertexQuota(opts.modelId, err)) {
        const fb = vertexQuotaFallbackTargetModel(opts.modelId)
        console.warn(`[vertex] cuota 429 en ${opts.modelId}; reintentando con ${fb}`)
        return streamGoogleFormatGenerate(token, {
          ...opts,
          modelId: fb,
        })
      }
      throw err
    }
  }

  return streamGoogleFormatGenerate(token, opts)
}

async function streamGoogleFormatGenerate(
  token: string,
  opts: AgentPlatformStreamOpts,
): Promise<AgentPlatformStreamResult> {
  let lastError: Error | null = null

  for (const attemptId of vertexGenerateModelAttemptOrder(opts.modelId)) {
    const route = resolveVertexModelRoute(attemptId)
    const url = buildVertexPublisherUrl(route, 'streamGenerateContent')
    for (let retry = 0; retry < VERTEX_TEXT_MAX_RETRIES; retry++) {
      try {
        return await streamGoogleFormatGenerateOnce(url, token, { ...opts, modelId: attemptId })
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        lastError = err
        if (isRetryableVertexTextFallback(err, attemptId)) break
        if (isRetryableVertexRateLimitError(err) && retry < VERTEX_TEXT_MAX_RETRIES - 1) {
          const backoff = VERTEX_TEXT_RETRY_BASE_MS * 2 ** retry
          console.warn(
            `[vertex] ${attemptId} ${vertexTextHttpStatus(err) ?? 'rate-limit'}, reintento ${retry + 2}/${VERTEX_TEXT_MAX_RETRIES} en ${backoff}ms`,
          )
          await sleepMs(backoff)
          continue
        }
        break
      }
    }
  }

  throw lastError ?? new Error('Vertex Agent Platform: modelo no disponible')
}

async function streamGoogleFormatGenerateOnce(
  url: string,
  token: string,
  opts: AgentPlatformStreamOpts,
): Promise<AgentPlatformStreamResult> {
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: buildVertexUserParts(opts.prompt, opts.images) }],
    generationConfig: googleGenerationConfig(opts.maxOutputTokens),
  }

  if (opts.cachedContent?.trim()) {
    body.cachedContent = opts.cachedContent.trim()
  } else if (opts.systemInstruction.trim()) {
    body.system_instruction = { parts: [{ text: opts.systemInstruction }] }
  }

  if (opts.thinkingLevel && resolveVertexPublisher(opts.modelId) === 'google') {
    body.generationConfig = {
      ...(body.generationConfig as Record<string, unknown>),
      thinkingConfig: {
        thinkingBudget:
          opts.thinkingLevel === 'high' ? 8192 : opts.thinkingLevel === 'medium' ? 2048 : 512,
      },
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(
      isVertexModelNotFound(res.status, errText)
        ? `Vertex Agent Platform error 404: ${errText}`
        : `Vertex Agent Platform error ${res.status}: ${errText}`,
    )
  }

  const responseText = await res.text()
  let fullText = ''
  let usage = usageFromGeminiResponseText(responseText)

  try {
    const chunks = JSON.parse(responseText) as Array<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }>
    for (const chunk of chunks) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!text) continue
      fullText += text
      opts.onToken(text)
      const chunkUsage = usageFromGeminiChunk(chunk)
      if (chunkUsage) usage = chunkUsage
    }
  } catch {
    fullText = responseText
    opts.onToken(responseText)
  }

  return { text: fullText, usage }
}

async function streamAnthropicRawPredict(
  url: string,
  token: string,
  opts: AgentPlatformStreamOpts,
): Promise<AgentPlatformStreamResult> {
  const combined = opts.systemInstruction.trim()
    ? `${opts.systemInstruction.trim()}\n\n---\n\n${opts.prompt}`
    : opts.prompt

  const body = {
    anthropic_version: ANTHROPIC_VERSION,
    messages: [{ role: 'user', content: combined }],
    max_tokens: anthropicMaxOutputTokens(opts.maxOutputTokens),
    stream: true,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Vertex Agent Platform (Anthropic) error ${res.status}: ${errText}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('text/event-stream') && res.body) {
    return readAnthropicSseStream(res.body, opts.onToken)
  }

  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  const fullText =
    json.content
      ?.filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text!)
      .join('') ?? ''
  if (fullText) opts.onToken(fullText)
  return { text: fullText, usage: usageFromAnthropicJson(json) }
}

async function readAnthropicSseStream(
  body: ReadableStream<Uint8Array>,
  onToken: (text: string) => void,
): Promise<AgentPlatformStreamResult> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let usage = emptyTokenUsage()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const data = JSON.parse(payload) as {
          type?: string
          delta?: { type?: string; text?: string }
          message?: { usage?: { input_tokens?: number; output_tokens?: number } }
          usage?: { input_tokens?: number; output_tokens?: number }
        }
        const u = usageFromAnthropicSsePayload(data)
        if (u) usage = u
        if (
          data.type === 'content_block_delta' &&
          data.delta?.type === 'text_delta' &&
          data.delta.text
        ) {
          fullText += data.delta.text
          onToken(data.delta.text)
        }
      } catch {
        /* ignore malformed SSE chunks */
      }
    }
  }

  return { text: fullText, usage }
}

async function streamOpenApiChatCompletions(
  url: string,
  token: string,
  opts: AgentPlatformStreamOpts,
  openApiModelId: string,
): Promise<AgentPlatformStreamResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: openApiModelId,
      messages: buildOpenApiChatMessages(opts.prompt, opts.systemInstruction),
      max_tokens: openApiMaxOutputTokens(opts.maxOutputTokens),
      stream: true,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(
      isVertexModelNotFound(res.status, errText)
        ? `Vertex Agent Platform (OpenAPI) error 404: ${errText}`
        : `Vertex Agent Platform (OpenAPI) error ${res.status}: ${errText}`,
    )
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('text/event-stream') && res.body) {
    return readOpenApiSseStream(res.body, opts.onToken)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const fullText = json.choices?.[0]?.message?.content ?? ''
  if (fullText) opts.onToken(fullText)
  return { text: fullText, usage: usageFromOpenAiChatChunk(json) ?? emptyTokenUsage() }
}

async function readOpenApiSseStream(
  body: ReadableStream<Uint8Array>,
  onToken: (text: string) => void,
): Promise<AgentPlatformStreamResult> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let usage = emptyTokenUsage()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const data = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>
          usage?: { prompt_tokens?: number; completion_tokens?: number }
        }
        const u = usageFromOpenAiChatChunk(data)
        if (u) usage = u
        const delta = data.choices?.[0]?.delta?.content
        if (delta) {
          fullText += delta
          onToken(delta)
        }
      } catch {
        /* ignore malformed SSE chunks */
      }
    }
  }

  return { text: fullText, usage }
}

async function generateOpenApiChatCompletions(
  token: string,
  route: VertexModelRoute,
  prompt: string,
  opts?: {
    systemInstruction?: string
    maxOutputTokens?: number
    temperature?: number
  },
): Promise<string> {
  const url = buildVertexOpenApiChatUrl(route.location)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: route.apiModelId,
      messages: buildOpenApiChatMessages(prompt, opts?.systemInstruction),
      max_tokens: openApiMaxOutputTokens(opts?.maxOutputTokens),
      stream: false,
      ...(opts?.temperature != null ? { temperature: opts.temperature } : {}),
    }),
  })

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }

  if (!res.ok) {
    const detail = data.error?.message ?? JSON.stringify(data)
    throw new Error(
      isVertexModelNotFound(res.status, detail)
        ? `Vertex Agent Platform (OpenAPI) error 404: ${detail}`
        : `Vertex Agent Platform (OpenAPI) error ${res.status}: ${detail}`,
    )
  }

  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

/** Generación síncrona vía Agent Platform (mejorar prompt, memoria, etc.). */
export async function generateAgentPlatformText(
  prompt: string,
  opts?: {
    model?: string
    systemInstruction?: string
    maxOutputTokens?: number
    temperature?: number
    images?: VertexImagePart[]
    responseMimeType?: string
    /** Chat en vivo, SSE, etc. — no usar Vertex Batch API. */
    preferRealtime?: boolean
    /** Tareas sin tiempo real (p. ej. mejorar prompt): usar Batch si el admin lo tiene activo. */
    preferBatch?: boolean
  },
): Promise<string> {
  const modelId = opts?.model ?? 'gemini-2.5-flash-lite'
  const route = resolveVertexModelRoute(modelId)
  const token = await getVertexBearerToken()

  if (route.method === 'openApiChatCompletions' && !opts?.images?.length) {
    try {
      return await generateOpenApiChatCompletions(token, route, prompt, {
        systemInstruction: opts?.systemInstruction,
        maxOutputTokens: opts?.maxOutputTokens,
        temperature: opts?.temperature,
      })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      if (shouldFallbackFromVertexQuota(modelId, err)) {
        const fb = vertexQuotaFallbackTargetModel(modelId)
        console.warn(`[vertex] cuota 429 en ${modelId}; generateContent con ${fb}`)
        return generateAgentPlatformText(prompt, { ...opts, model: fb })
      }
      throw err
    }
  }

  if (route.method === 'openApiChatCompletions' && opts?.images?.length) {
    console.warn(
      `[vertex] ${modelId} (OpenAPI) no admite imágenes; usando ${DEFAULT_GEMINI_MODEL} multimodal`,
    )
    return generateAgentPlatformText(prompt, {
      ...opts,
      model: DEFAULT_GEMINI_MODEL,
      preferRealtime: true,
    })
  }

  const tryBatch =
    !opts?.preferRealtime &&
    route.publisher === 'google' &&
    route.method === 'streamGenerateContent' &&
    (opts?.preferBatch === true || opts?.preferBatch === undefined)

  if (tryBatch) {
    const { shouldUseVertexGeminiBatchApi, generateVertexGeminiBatchText } = await import(
      '@/lib/platform/vertexGeminiBatch.server'
    )
    if (
      await shouldUseVertexGeminiBatchApi({
        preferRealtime: opts?.preferRealtime,
        images: opts?.images,
        modelId,
      })
    ) {
      try {
        return await generateVertexGeminiBatchText({
          prompt,
          modelId,
          systemInstruction: opts?.systemInstruction,
          maxOutputTokens: opts?.maxOutputTokens,
          temperature: opts?.temperature,
          responseMimeType: opts?.responseMimeType,
          preferRealtime: opts?.preferRealtime,
        })
      } catch (batchErr) {
        console.warn(
          '[vertex] Batch API falló; reintentando con generateContent síncrono:',
          batchErr instanceof Error ? batchErr.message : batchErr,
        )
      }
    }
  }

  if (route.method !== 'streamRawPredict') {
    let lastError: Error | null = null
    for (const attemptId of vertexGenerateModelAttemptOrder(modelId)) {
      const attemptRoute = resolveVertexModelRoute(attemptId)
      const url = buildVertexPublisherUrl(attemptRoute, 'generateContent')
      for (let retry = 0; retry < VERTEX_TEXT_MAX_RETRIES; retry++) {
        try {
          const body: Record<string, unknown> = {
            contents: [
              { role: 'user', parts: buildVertexUserParts(prompt, opts?.images) },
            ],
            generationConfig: googleGenerationConfig(opts?.maxOutputTokens, {
              temperature: opts?.temperature ?? 0.3,
              ...(opts?.responseMimeType
                ? { responseMimeType: opts.responseMimeType }
                : {}),
            }),
          }
          if (opts?.systemInstruction?.trim()) {
            body.systemInstruction = { parts: [{ text: opts.systemInstruction.trim() }] }
          }
          const res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = (await res.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
            error?: { message?: string }
          }
          if (!res.ok) {
            const detail = data.error?.message ?? JSON.stringify(data)
            throw new Error(
              isVertexModelNotFound(res.status, detail)
                ? `Vertex Agent Platform error 404: ${detail}`
                : `Vertex Agent Platform error ${res.status}: ${detail}`,
            )
          }
          if (attemptId !== modelId) {
            const usedGlobal = googleVertexLocationForModel(modelId) === 'global'
            console.warn(
              `[vertex] generateContent OK con modelo alternativo ${attemptId} (solicitado: ${modelId}` +
                `${usedGlobal ? ', endpoint global' : ''}). ` +
                `Si pediste Gemini 3.x y ves 2.5, comprueba acceso al modelo en el proyecto Vertex.`,
            )
          }
          return (
            data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? ''
          )
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e))
          lastError = err
          if (isRetryableVertexTextFallback(err, attemptId)) break
          if (isRetryableVertexRateLimitError(err) && retry < VERTEX_TEXT_MAX_RETRIES - 1) {
            const backoff = VERTEX_TEXT_RETRY_BASE_MS * 2 ** retry
            console.warn(
              `[vertex] ${attemptId} ${vertexTextHttpStatus(err) ?? 'rate-limit'}, reintento ${retry + 2}/${VERTEX_TEXT_MAX_RETRIES} en ${backoff}ms`,
            )
            await sleepMs(backoff)
            continue
          }
          break
        }
      }
    }
    throw lastError ?? new Error('Vertex Agent Platform: modelo no disponible')
  }

  if (route.method === 'streamRawPredict') {
    try {
      const url = buildVertexPublisherUrl(route, 'streamRawPredict')
      const combined = opts?.systemInstruction?.trim()
        ? `${opts.systemInstruction.trim()}\n\n---\n\n${prompt}`
        : prompt
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anthropic_version: ANTHROPIC_VERSION,
          messages: [{ role: 'user', content: combined }],
          max_tokens: anthropicMaxOutputTokens(opts?.maxOutputTokens),
          stream: false,
        }),
      })
      const data = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>
        error?: { message?: string }
      }
      if (!res.ok) {
        throw new Error(
          data.error?.message ?? `Vertex Agent Platform (Anthropic) error ${res.status}`,
        )
      }
      return (
        data.content
          ?.filter((b) => b.type === 'text' && b.text)
          .map((b) => b.text!)
          .join('')
          .trim() ?? ''
      )
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      if (shouldFallbackFromVertexQuota(modelId, err)) {
        const fb = vertexQuotaFallbackTargetModel(modelId)
        console.warn(`[vertex] cuota 429 en ${modelId}; generateContent con ${fb}`)
        return generateAgentPlatformText(prompt, {
          ...opts,
          model: fb,
        })
      }
      throw err
    }
  }

  throw new Error(`Publisher no soportado para generateContent: ${route.publisher}`)
}

export type AgentPlatformImageResult = {
  data: string
  mimeType: string
}

function normalizeImageAspectRatio(aspect: string): string {
  const a = aspect.trim()
  if (['1:1', '3:4', '4:3', '9:16', '16:9'].includes(a)) return a
  return '16:9'
}

function nanoBananaGenerationConfig(aspect: string): Record<string, unknown> {
  return {
    responseModalities: ['IMAGE'],
    imageConfig: { aspectRatio: normalizeImageAspectRatio(aspect) },
  }
}

function extractImageFromGeminiResponse(data: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string }
      }>
    }
  }>
}): AgentPlatformImageResult | null {
  const parts = data.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    const mime = part.inlineData?.mimeType
    const raw = part.inlineData?.data
    if (mime?.startsWith('image/') && raw) {
      return { data: raw, mimeType: mime }
    }
  }
  return null
}

/**
 * Generación de imagen con Nano Banana (Gemini image) vía Vertex AI Agent Platform.
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview
 */
export async function generateAgentPlatformImage(
  prompt: string,
  opts?: { aspect?: string; modelId?: string; styleReference?: { mimeType: string; data: string } },
): Promise<AgentPlatformImageResult | null> {
  const modelId = opts?.modelId ?? 'gemini-2.5-flash-image'
  if (resolveVertexPublisher(modelId) !== 'google') {
    throw new Error(`Generación de imagen solo disponible con modelos Gemini (Nano Banana): ${modelId}`)
  }

  const token = await getVertexBearerToken()
  const route = resolveVertexModelRoute(modelId)
  const url = buildVertexPublisherUrl(route, 'generateContent')

  const parts: Array<Record<string, unknown>> = []
  if (opts?.styleReference) {
    parts.push({
      inlineData: {
        mimeType: opts.styleReference.mimeType,
        data: opts.styleReference.data,
      },
    })
    parts.push({ text: `Use ONLY the photographic style, lighting, color grading, and color palette of this reference image. Do NOT reproduce any text, logos, navigation menus, UI elements, or overlays from the reference — generate ONLY the photographic subject. Subject: ${prompt}` })
  } else {
    parts.push({ text: prompt })
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: nanoBananaGenerationConfig(opts?.aspect ?? '16:9'),
    }),
  })

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string }
        }>
      }
    }>
    error?: { message?: string; code?: number }
  }

  if (!res.ok) {
    const detail = data.error?.message ?? JSON.stringify(data)
    const err = new Error(`Vertex Agent Platform (Nano Banana) error ${res.status}: ${detail}`)
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }

  const img = extractImageFromGeminiResponse(data)
  if (!img) {
    throw new Error(`Vertex Agent Platform: respuesta sin imagen (modelo ${modelId})`)
  }
  return img
}

function buildImagenPredictUrl(modelId: string): string {
  const creds = getVertexAICredentials()
  if (!creds) throw new Error('Vertex AI no configurado')
  const location = creds.location
  const host =
    location === 'global'
      ? 'aiplatform.googleapis.com'
      : `${location}-aiplatform.googleapis.com`
  return `https://${host}/v1/projects/${creds.projectId}/locations/${location}/publishers/google/models/${modelId}:predict`
}

export type ImagenPredictOpts = {
  aspect?: string
  modelId?: string
  sampleCount?: number
  negativePrompt?: string
}

/**
 * Generación de mockup con Imagen 4 vía Vertex :predict.
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/imagen-api
 */
export async function generateImagen4Image(
  prompt: string,
  opts?: ImagenPredictOpts,
): Promise<AgentPlatformImageResult | null> {
  const modelId = opts?.modelId ?? DEFAULT_IMAGE_GEN_MODEL
  if (!isImagenModelId(modelId)) {
    throw new Error(`Modelo Imagen no soportado: ${modelId}`)
  }

  const token = await getVertexBearerToken()
  const url = buildImagenPredictUrl(modelId)
  const aspectRatio = normalizeDesignAspectRatio(opts?.aspect)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: opts?.sampleCount ?? 1,
        aspectRatio,
        outputOptions: { mimeType: 'image/png' },
        ...(opts?.negativePrompt?.trim()
          ? { negativePrompt: opts.negativePrompt.trim() }
          : {}),
      },
    }),
  })

  const data = (await res.json()) as {
    predictions?: Array<{
      bytesBase64Encoded?: string
      mimeType?: string
    }>
    error?: { message?: string; code?: number }
  }

  if (!res.ok) {
    const detail = data.error?.message ?? JSON.stringify(data)
    const err = new Error(`Vertex Imagen error ${res.status}: ${detail}`)
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }

  const pred = data.predictions?.[0]
  const raw = pred?.bytesBase64Encoded
  if (!raw) {
    throw new Error(`Vertex Imagen: respuesta sin imagen (modelo ${modelId})`)
  }
  return {
    data: raw,
    mimeType: pred?.mimeType?.startsWith('image/') ? pred.mimeType : 'image/png',
  }
}

/** Varias muestras Imagen 4 (sampleCount 1–4). */
export async function generateImagen4Images(
  prompt: string,
  opts?: ImagenPredictOpts,
): Promise<AgentPlatformImageResult[]> {
  const modelId = opts?.modelId ?? DEFAULT_IMAGE_GEN_MODEL
  if (!isImagenModelId(modelId)) {
    throw new Error(`Modelo Imagen no soportado: ${modelId}`)
  }

  const sampleCount = Math.min(4, Math.max(1, opts?.sampleCount ?? 1))
  const token = await getVertexBearerToken()
  const url = buildImagenPredictUrl(modelId)
  const aspectRatio = normalizeDesignAspectRatio(opts?.aspect)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount,
        aspectRatio,
        outputOptions: { mimeType: 'image/png' },
        ...(opts?.negativePrompt?.trim()
          ? { negativePrompt: opts.negativePrompt.trim() }
          : {}),
      },
    }),
  })

  const data = (await res.json()) as {
    predictions?: Array<{
      bytesBase64Encoded?: string
      mimeType?: string
    }>
    error?: { message?: string; code?: number }
  }

  if (!res.ok) {
    const detail = data.error?.message ?? JSON.stringify(data)
    const err = new Error(`Vertex Imagen error ${res.status}: ${detail}`)
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }

  const out: AgentPlatformImageResult[] = []
  for (const pred of data.predictions ?? []) {
    const raw = pred?.bytesBase64Encoded
    if (!raw) continue
    out.push({
      data: raw,
      mimeType: pred?.mimeType?.startsWith('image/') ? pred.mimeType : 'image/png',
    })
  }
  if (!out.length) {
    throw new Error(`Vertex Imagen: respuesta sin imagen (modelo ${modelId})`)
  }
  return out
}

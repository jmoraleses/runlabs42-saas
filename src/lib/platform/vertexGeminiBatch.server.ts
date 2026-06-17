import 'server-only'

import { GoogleGenAI, JobState } from '@google/genai'
import type { VertexImagePart } from '@/lib/ai/vertexAgentPlatform'
import { getVertexAICredentials } from '@/lib/ai/config.server'
import { toVertexModelId, vertexTextFallbackModelId } from '@/lib/ai/constants'
import { getCatalogModel } from '@/lib/ai/catalog'
import { isVertexGeminiBatchApiEnabled } from '@/lib/platform/vertexGeminiBatchSetting.server'

const BATCH_POLL_MS = 3_000
const BATCH_TIMEOUT_MS = 20 * 60_000

const TERMINAL_BATCH_STATES = new Set([
  JobState.JOB_STATE_SUCCEEDED,
  JobState.JOB_STATE_FAILED,
  JobState.JOB_STATE_CANCELLED,
  JobState.JOB_STATE_EXPIRED,
  JobState.JOB_STATE_PARTIALLY_SUCCEEDED,
])

export type VertexGeminiBatchTextOpts = {
  prompt: string
  systemInstruction?: string
  modelId: string
  maxOutputTokens?: number
  temperature?: number
  responseMimeType?: string
  images?: VertexImagePart[]
  /** Streaming SSE, chat en vivo, etc. — fuerza generateContent síncrono. */
  preferRealtime?: boolean
}

let genAiClient: GoogleGenAI | null = null

function getGenAiVertexClient(): GoogleGenAI {
  if (genAiClient) return genAiClient
  const creds = getVertexAICredentials()
  if (!creds) throw new Error('Vertex AI no configurado')

  genAiClient = new GoogleGenAI({
    vertexai: true,
    project: creds.projectId,
    location: creds.location,
    googleAuthOptions: {
      credentials: {
        client_email: creds.clientEmail,
        private_key: creds.privateKey,
      },
    },
  })
  return genAiClient
}

function buildUserParts(
  prompt: string,
  images?: VertexImagePart[],
): Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
  for (const img of images ?? []) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data.replace(/^data:[^;]+;base64,/, ''),
      },
    })
  }
  parts.push({ text: prompt })
  return parts
}

function textFromBatchJob(job: {
  dest?: {
    inlinedResponses?: Array<{
      response?: { text?: string }
      error?: { message?: string }
    }>
  }
}): string {
  const inlined = job.dest?.inlinedResponses?.[0]
  if (inlined?.error?.message) {
    throw new Error(`Vertex Batch API: ${inlined.error.message}`)
  }
  const text = inlined?.response?.text
  return typeof text === 'string' ? text.trim() : ''
}

/**
 * Vertex Batch (cliente `vertexai: true`) exige entrada/salida en gs:// o bq://.
 * Las peticiones inline de `batches.create({ src: [...] })` fallan con
 * "No GCS or BigQuery URI found". Activar batch solo cuando exista staging GCS.
 */
const VERTEX_GEMINI_BATCH_GCS_READY = false

export async function shouldUseVertexGeminiBatchApi(
  opts: Pick<VertexGeminiBatchTextOpts, 'preferRealtime' | 'images' | 'modelId'>,
): Promise<boolean> {
  if (!VERTEX_GEMINI_BATCH_GCS_READY) return false
  if (opts.preferRealtime) return false
  if (opts.images?.length) return false
  const catalog = getCatalogModel(opts.modelId)
  if (catalog && catalog.vendor !== 'google') return false
  return isVertexGeminiBatchApiEnabled()
}

function vertexBatchModelAttemptIds(modelId: string): string[] {
  const fallback = vertexTextFallbackModelId(modelId)
  const ids = fallback ? [modelId, fallback] : [modelId]
  return [...new Set(ids.map(toVertexModelId))]
}

function isBatchModelNotFound(err: Error): boolean {
  return /404|NOT_FOUND|was not found/i.test(err.message)
}

export async function generateVertexGeminiBatchText(
  opts: VertexGeminiBatchTextOpts,
): Promise<string> {
  const ai = getGenAiVertexClient()
  const config: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.3,
    maxOutputTokens: opts.maxOutputTokens,
  }
  if (opts.systemInstruction?.trim()) {
    config.systemInstruction = opts.systemInstruction.trim()
  }
  if (opts.responseMimeType) {
    config.responseMimeType = opts.responseMimeType
  }

  let lastError: Error | null = null
  for (const model of vertexBatchModelAttemptIds(opts.modelId)) {
    try {
      return await runSingleVertexGeminiBatchJob(ai, {
        model,
        prompt: opts.prompt,
        images: opts.images,
        config,
      })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      lastError = err
      if (!isBatchModelNotFound(err) || !vertexTextFallbackModelId(opts.modelId)) throw err
    }
  }
  throw lastError ?? new Error('Vertex Batch API: modelo no disponible')
}

async function runSingleVertexGeminiBatchJob(
  ai: GoogleGenAI,
  args: {
    model: string
    prompt: string
    images?: VertexImagePart[]
    config: Record<string, unknown>
  },
): Promise<string> {
  const job = await ai.batches.create({
    model: args.model,
    src: [
      {
        contents: [{ role: 'user', parts: buildUserParts(args.prompt, args.images) }],
        config: args.config,
      },
    ],
    config: {
      displayName: `runlabs42-batch-${Date.now()}`,
    },
  })

  const name = job.name
  if (!name) throw new Error('Vertex Batch API: job sin nombre')

  const deadline = Date.now() + BATCH_TIMEOUT_MS
  let latest = job

  while (Date.now() < deadline) {
    latest = await ai.batches.get({ name })
    const state = latest.state
    if (state && TERMINAL_BATCH_STATES.has(state)) break
    await new Promise((r) => setTimeout(r, BATCH_POLL_MS))
  }

  if (!latest.state || !TERMINAL_BATCH_STATES.has(latest.state)) {
    throw new Error('Vertex Batch API: tiempo de espera agotado')
  }
  if (latest.state !== JobState.JOB_STATE_SUCCEEDED) {
    const msg = latest.error?.message ?? latest.state
    throw new Error(`Vertex Batch API: ${msg}`)
  }

  const text = textFromBatchJob(latest)
  if (!text) throw new Error('Vertex Batch API: respuesta vacía')
  return text
}

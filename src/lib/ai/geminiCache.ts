import { createHash } from 'node:crypto'
import { getVertexContextCacheSetting } from '@/lib/platform/vertexContextCacheSetting.server'

/**
 * Context caching para Gemini — soporta Vertex AI (cuenta de servicio) y AI Studio (API key).
 *
 * Docs Vertex AI: https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview
 * Docs AI Studio: https://ai.google.dev/gemini-api/docs/caching
 */

/** ~4 chars por token — estimación conservadora. */
const CHARS_PER_TOKEN = 4
/** TTL del caché en segundos (1 hora). */
const CACHE_TTL_SECONDS = 3600

export type CacheEntry = {
  name: string
  expiresAt: number
  modelId: string
  contentHash: string
}

/** Caché en memoria para la sesión del servidor (se limpia al reiniciar). */
const memCache = new Map<string, CacheEntry>()

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

type CacheOpts = {
  modelId: string
  systemInstruction: string
  staticContent: string
} & (
  | { apiKey: string; credentials?: never }
  | { credentials: { projectId: string; location: string; clientEmail: string; privateKey: string }; apiKey?: never }
)

async function getVertexAuthToken(clientEmail: string, privateKey: string): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  return token.token ?? ''
}

async function createVertexCache(opts: {
  credentials: NonNullable<CacheOpts['credentials']>
  modelId: string
  systemInstruction: string
  staticContent: string
}): Promise<string | null> {
  const { credentials, modelId, systemInstruction, staticContent } = opts
  const { projectId, location, clientEmail, privateKey } = credentials

  const token = await getVertexAuthToken(clientEmail, privateKey)
  if (!token) return null

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/cachedContents`

  const body = {
    model: `projects/${projectId}/locations/${location}/publishers/google/models/${modelId}`,
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: staticContent }] }],
    ttl: `${CACHE_TTL_SECONDS}s`,
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) return null

  const data = await res.json() as { name?: string }
  return data.name ?? null
}

async function createAIStudioCache(opts: {
  apiKey: string
  modelId: string
  systemInstruction: string
  staticContent: string
}): Promise<string | null> {
  const { apiKey, modelId, systemInstruction, staticContent } = opts
  const CACHE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

  const body = {
    model: `models/${modelId}`,
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: staticContent }] }],
    ttl: `${CACHE_TTL_SECONDS}s`,
  }

  const res = await fetch(`${CACHE_BASE_URL}/cachedContents?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) return null

  const data = await res.json() as { name?: string }
  return data.name ?? null
}

export async function getOrCreateCache(opts: CacheOpts): Promise<string | null> {
  const { modelId, systemInstruction, staticContent } = opts

  const cacheSetting = await getVertexContextCacheSetting()
  if (!cacheSetting.enabled) return null

  const combined = systemInstruction + staticContent
  const tokens = estimateTokens(combined)
  if (tokens < cacheSetting.minTokens) return null

  const contentHash = hashContent(combined)
  const cacheKey = `${modelId}:${contentHash}`

  const existing = memCache.get(cacheKey)
  if (existing && existing.expiresAt > Date.now() + 60_000) {
    return existing.name
  }

  try {
    let name: string | null = null

    if (opts.credentials) {
      name = await createVertexCache({ credentials: opts.credentials, modelId, systemInstruction, staticContent })
    } else if (opts.apiKey) {
      name = await createAIStudioCache({ apiKey: opts.apiKey, modelId, systemInstruction, staticContent })
    }

    if (!name) return null

    memCache.set(cacheKey, {
      name,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
      modelId,
      contentHash,
    })

    return name
  } catch {
    return null
  }
}

export function pruneExpiredCaches(): void {
  const now = Date.now()
  for (const [key, entry] of memCache) {
    if (entry.expiresAt <= now) memCache.delete(key)
  }
}

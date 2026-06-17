import {
  IMAGEN3_GEN_MODEL,
  IMAGEN3_GEN_MODEL_FAST,
  IMAGE_GEN_MODEL,
  isImagenModelId,
} from '@/lib/ai/constants'
import { isStableImageModelId } from '@/lib/ai/imageModels'

function isProbeableImageModelId(modelId: string): boolean {
  return isStableImageModelId(modelId)
}
import { isVertexAIConfigured } from '@/lib/ai/config.server'
import {
  generateAgentPlatformImage,
  generateImagen4Image,
} from '@/lib/ai/vertexAgentPlatform'

const PROBE_PROMPT = 'Minimal flat UI icon, single blue circle on white, no text'
const PROBE_ASPECT = '1:1'

/** Orden de prueba para assets HTML (Imagen 3 GA por defecto). */
export const DESIGN_ASSET_IMAGE_PROBE_CANDIDATES = [
  IMAGEN3_GEN_MODEL_FAST,
  IMAGEN3_GEN_MODEL,
] as const

type ProbeEntry = {
  ok: boolean
  status?: number
  probedAt: number
}

const probeCache = new Map<string, ProbeEntry>()

const TTL_OK_MS = 20 * 60 * 1000
const TTL_RETRYABLE_FAIL_MS = 4 * 60 * 1000
const TTL_HARD_FAIL_MS = 60 * 60 * 1000

function cacheTtl(entry: ProbeEntry): number {
  if (entry.ok) return TTL_OK_MS
  if (entry.status === 429 || entry.status === 503) return TTL_RETRYABLE_FAIL_MS
  return TTL_HARD_FAIL_MS
}

function cacheFresh(entry: ProbeEntry): boolean {
  return Date.now() - entry.probedAt < cacheTtl(entry)
}

function errorStatus(err: unknown): number | undefined {
  return (err as Error & { status?: number }).status
}

/** Prueba un modelo con un prompt mínimo (1 imagen). */
export async function probeVertexImageModel(modelId: string): Promise<boolean> {
  const trimmed = modelId.trim()
  if (!trimmed || !isProbeableImageModelId(trimmed)) return false

  const cached = probeCache.get(trimmed)
  if (cached && cacheFresh(cached)) return cached.ok

  if (!isVertexAIConfigured()) {
    return false
  }

  let ok = false
  let status: number | undefined
  try {
    const img = isImagenModelId(trimmed)
      ? await generateImagen4Image(PROBE_PROMPT, {
          aspect: PROBE_ASPECT,
          modelId: trimmed,
          sampleCount: 1,
        })
      : await generateAgentPlatformImage(PROBE_PROMPT, {
          aspect: PROBE_ASPECT,
          modelId: trimmed,
        })
    ok = Boolean(img?.data)
    if (!ok) status = 502
  } catch (err) {
    status = errorStatus(err)
    ok = false
    console.info(
      `[vertexImageProbe] ${trimmed} no disponible${status != null ? ` (${status})` : ''}:`,
      err instanceof Error ? err.message.slice(0, 120) : err,
    )
  }

  probeCache.set(trimmed, { ok, status, probedAt: Date.now() })
  return ok
}

/** Marca un modelo como fallido tras un error en producción (evita reintentos inmediatos). */
export function markVertexImageModelFailed(modelId: string, status?: number): void {
  const trimmed = modelId.trim()
  if (!trimmed) return
  probeCache.set(trimmed, { ok: false, status, probedAt: Date.now() })
}

export function invalidateVertexImageModelProbeCache(): void {
  probeCache.clear()
}

function uniqueStableIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const t = id.trim()
    if (!t || seen.has(t) || !isProbeableImageModelId(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/**
 * Modelos Vertex que respondieron OK en la última sonda (en orden de preferencia).
 * Si ninguno pasa la sonda, devuelve [].
 */
export async function getProbedVertexImageModelIds(
  preferredOrder: readonly string[],
): Promise<string[]> {
  if (!isVertexAIConfigured()) return []

  const candidates = uniqueStableIds([
    ...preferredOrder,
    ...DESIGN_ASSET_IMAGE_PROBE_CANDIDATES,
  ])

  const working: string[] = []
  for (const modelId of candidates) {
    const cached = probeCache.get(modelId)
    if (cached && cacheFresh(cached)) {
      if (cached.ok) working.push(modelId)
      continue
    }
    if (await probeVertexImageModel(modelId)) {
      working.push(modelId)
    }
  }

  if (!working.length && !candidates.includes(IMAGE_GEN_MODEL)) {
    if (await probeVertexImageModel(IMAGE_GEN_MODEL)) {
      working.push(IMAGE_GEN_MODEL)
    }
  }

  return working
}

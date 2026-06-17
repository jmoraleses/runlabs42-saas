import { MODEL_CATALOG, type ModelCategory } from '@/lib/ai/catalog'
import {
  DEFAULT_GEMINI_MODEL,
  vertexTextFallbackModelId,
  vertexTextProactiveFallbackModelId,
} from '@/lib/ai/constants'
import { resolveStableImageModelId } from '@/lib/ai/imageModels'

/** Modelos publicados como GA y habilitados en el catálogo (existen en Vertex Agent Platform). */
export function isVertexGaCatalogModelId(modelId: string): boolean {
  const id = modelId.trim()
  if (!id) return false
  const row = MODEL_CATALOG.find((m) => m.id === id)
  return Boolean(row?.enabled && row.status === 'ga')
}

export function listVertexGaModelIds(category?: ModelCategory): string[] {
  return MODEL_CATALOG.filter(
    (m) => m.enabled && m.status === 'ga' && (!category || m.category === category),
  ).map((m) => m.id)
}

/** Texto / chat / diseño (Gemini, Claude, OpenAI/Llama/DeepSeek MaaS en Vertex). */
export function isVertexAgentTextModelId(modelId: string): boolean {
  const id = modelId.trim()
  if (!id) return false
  const row = MODEL_CATALOG.find((m) => m.id === id)
  return Boolean(
    row?.enabled &&
    row.category === 'text' &&
    (row.status === 'ga' || row.status === 'preview'),
  )
}

/** Rechaza preview, 2.0 retirado y ids arbitrarios del entorno. */
export function resolveVertexAgentTextModelId(
  raw: string | undefined | null,
  fallback: string = DEFAULT_GEMINI_MODEL,
): string {
  const trimmed = raw?.trim()
  const proactive = trimmed ? vertexTextProactiveFallbackModelId(trimmed) : undefined
  if (proactive && isVertexAgentTextModelId(proactive)) return proactive
  if (trimmed && isVertexAgentTextModelId(trimmed)) return trimmed

  const upgraded = trimmed ? vertexTextProactiveFallbackModelId(trimmed) : undefined
  if (upgraded && isVertexAgentTextModelId(upgraded)) return upgraded

  const fb = fallback.trim()
  if (fb && isVertexAgentTextModelId(fb)) return fb

  return DEFAULT_GEMINI_MODEL
}

/** Imagen (Imagen 3/4 + Nano Banana GA). */
export function resolveVertexImageModelId(
  raw: string | undefined | null,
  fallback?: string,
): string {
  return resolveStableImageModelId(raw ?? fallback)
}

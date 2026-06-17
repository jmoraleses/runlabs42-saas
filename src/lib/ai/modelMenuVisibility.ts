import { CHAT_MODEL_IDS } from '@/lib/ai/catalog'
import { resolveCatalogModelForVertexId } from '@/lib/ai/catalogVertexResolve'
import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/modelTypes'

export const MODEL_MENU_VISIBILITY_SETTING_KEY = 'model_menu_visibility'

export type ModelMenuBucket = 'language' | 'coding' | 'ocr'

export type ModelMenuVisibility = Record<ModelMenuBucket, string[]>

export type ModelMenuBucketHints = {
  category?: string
  displayName?: string
  description?: string
}

export const EMPTY_MODEL_MENU_VISIBILITY: ModelMenuVisibility = {
  language: [],
  coding: [],
  ocr: [],
}

/** Modelos de generación de imagen/vídeo (no comprensión visual). */
const IMAGE_GENERATION_ID =
  /imagen[-_.]|\/imagen|veo[-_.]|flash-image|image-preview|generate-00\d|gemini-.*-image/i

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
}

function modelMeta(hints?: ModelMenuBucketHints): string {
  return `${hints?.displayName ?? ''} ${hints?.description ?? ''}`.toLowerCase()
}

export function isDedicatedOcrModel(modelId: string): boolean {
  return /ocr/i.test(modelId)
}

export function isImageGenerationModel(modelId: string, hints?: ModelMenuBucketHints): boolean {
  const id = modelId.toLowerCase()
  if (IMAGE_GENERATION_ID.test(id)) return true
  if (hints?.category === 'image' || hints?.category === 'video') return true
  return false
}

/** Vertex Model Garden: categoría «Comprensión de imágenes» / multimodal con entrada visual. */
export function isImageComprehensionModel(
  modelId: string,
  hints?: ModelMenuBucketHints,
): boolean {
  const id = modelId.toLowerCase()
  const meta = modelMeta(hints)

  if (isDedicatedOcrModel(id)) return true
  if (isImageGenerationModel(id, hints)) return false
  if (hints?.category === 'embedding') return false

  if (
    /comprensi[oó]n de im[aá]genes|image understanding|image comprehension|multimodal|visi[oó]n|vision/i.test(
      meta,
    )
  ) {
    return true
  }

  if (/^gemini-|google\/gemini-/.test(id) && !IMAGE_GENERATION_ID.test(id)) return true
  if (/^gemma-/.test(id)) return true
  if (/^claude-/.test(id) || id.includes('@anthropic')) return true
  if (/^llama-.*(instruct|maas)/i.test(id)) return true

  return false
}

export function inferModelMenuBuckets(
  modelId: string,
  hints?: ModelMenuBucketHints,
): ModelMenuBucket[] {
  const id = modelId.toLowerCase()

  if (isDedicatedOcrModel(id)) return ['ocr']

  if (isImageGenerationModel(id, hints)) return []

  const buckets: ModelMenuBucket[] = []

  if (isImageComprehensionModel(modelId, hints)) {
    buckets.push('ocr')
  }

  buckets.push('language')

  if (
    /gpt|oss|claude|deepseek|llama|composer|gemini|gemma|code|coder|r1|pro|sonnet|opus/.test(id) &&
    !isDedicatedOcrModel(id)
  ) {
    buckets.push('coding')
  }

  return uniq(buckets) as ModelMenuBucket[]
}

export function defaultModelMenuVisibility(
  modelIds: string[],
  hintsById?: Record<string, ModelMenuBucketHints>,
): ModelMenuVisibility {
  const language: string[] = []
  const coding: string[] = []
  const ocr: string[] = []
  for (const id of modelIds) {
    const buckets = inferModelMenuBuckets(id, hintsById?.[id])
    if (buckets.includes('language')) language.push(id)
    if (buckets.includes('coding')) coding.push(id)
    if (buckets.includes('ocr')) ocr.push(id)
  }
  return {
    language: uniq(language),
    coding: uniq(coding),
    ocr: uniq(ocr),
  }
}

export function parseModelMenuVisibility(
  value: unknown,
  validModelIds: string[],
  hintsById?: Record<string, ModelMenuBucketHints>,
): ModelMenuVisibility {
  const valid = new Set(validModelIds)
  const fallback = defaultModelMenuVisibility(validModelIds, hintsById)
  if (!value || typeof value !== 'object') return fallback

  const raw = value as Partial<Record<ModelMenuBucket, unknown>>
  const parsed: ModelMenuVisibility = { ...EMPTY_MODEL_MENU_VISIBILITY }
  for (const key of ['language', 'coding', 'ocr'] as const) {
    const arr = Array.isArray(raw[key]) ? raw[key] : []
    parsed[key] = uniq(
      arr.map((v) => (typeof v === 'string' ? v : '')).filter((id) => (valid.size ? valid.has(id) : true)),
    )
  }

  const hasAny = parsed.language.length || parsed.coding.length || parsed.ocr.length
  return hasAny ? parsed : fallback
}

export function visibleModelIdSet(visibility: ModelMenuVisibility): Set<string> {
  return new Set([...visibility.language, ...visibility.coding, ...visibility.ocr])
}

/** Hay selección guardada en admin (al menos un modelo en algún bucket). */
export function hasConfiguredModelMenuVisibility(visibility: ModelMenuVisibility | null | undefined): boolean {
  if (!visibility) return false
  return Boolean(visibility.language.length || visibility.coding.length || visibility.ocr.length)
}

/**
 * Convierte IDs guardados en admin (suelen ser IDs Vertex) a IDs del catálogo de chat.
 */
export function mapVisibilityIdsToChatCatalogIds(vertexOrCatalogIds: Iterable<string>): Set<string> {
  const out = new Set<string>()
  for (const rawId of vertexOrCatalogIds) {
    const id = rawId.trim()
    if (!id || id === AUTO_MODEL_ID || id === MAX_MODEL_ID) continue

    if (CHAT_MODEL_IDS.has(id)) {
      out.add(id)
      continue
    }

    const resolved = resolveCatalogModelForVertexId(id)
    if (resolved?.catalogId && CHAT_MODEL_IDS.has(resolved.catalogId)) {
      out.add(resolved.catalogId)
    }
  }
  return out
}

export function mapVisibilityToChatCatalogIds(visibility: ModelMenuVisibility): Set<string> {
  return mapVisibilityIdsToChatCatalogIds(visibleModelIdSet(visibility))
}

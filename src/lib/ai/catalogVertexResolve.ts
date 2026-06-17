import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/modelTypes'
import {
  getCatalogModel,
  MODEL_CATALOG,
  type CatalogModel,
  type ModelPricing,
} from '@/lib/ai/catalog'

export type CatalogVertexMatchKind = 'exact' | 'alias' | 'family' | 'none'

export type ResolvedVertexCatalogModel = {
  model: CatalogModel
  match: CatalogVertexMatchKind
  /** ID de catálogo usado para precio/metadatos (puede diferir del ID Vertex). */
  catalogId: string
}

/** Vertex / legacy ID → ID en MODEL_CATALOG. */
const VERTEX_TO_CATALOG_ALIASES: Record<string, string> = {
  'claude-opus-4-7@anthropic': 'claude-opus-4-7',
  'claude-sonnet-4-6@anthropic': 'claude-sonnet-4-6',
  'claude-haiku-4-5@anthropic': 'claude-haiku-4-5',
  'claude-sonnet-4-5@anthropic': 'claude-sonnet-4-5',
  'claude-opus-4-6@anthropic': 'claude-opus-4-6',
  'deepseek-v3.2-maas': 'deepseek-ai/deepseek-v3.2-maas',
  'deepseek-v3.1-maas': 'deepseek-ai/deepseek-v3.1-maas',
  'gemini-2.0-flash-001': 'google/gemini-2.0-flash-001',
  'google/gemini-2.0-flash-001': 'google/gemini-2.0-flash-001',
}

function hasUsablePricing(pricing: ModelPricing): boolean {
  return (
    pricing.inputPerM != null ||
    pricing.outputPerM != null ||
    pricing.perImage != null ||
    pricing.perSecondVideo != null
  )
}

/** Normaliza un ID devuelto por Vertex hacia formas del catálogo. */
export function normalizeVertexModelIdForCatalog(vertexId: string): string {
  let id = vertexId.trim()
  if (!id) return id

  const alias = VERTEX_TO_CATALOG_ALIASES[id]
  if (alias) return alias

  if (id.startsWith('google/')) {
    const stripped = id.slice('google/'.length)
    if (getCatalogModel(id)) return id
    if (getCatalogModel(stripped)) return stripped
    id = stripped
  }

  if (id.endsWith('@anthropic')) {
    const stripped = id.replace(/@anthropic$/, '')
    if (getCatalogModel(stripped)) return stripped
    id = stripped
  }

  const aliasAfterStrip = VERTEX_TO_CATALOG_ALIASES[id]
  if (aliasAfterStrip) return aliasAfterStrip

  return id
}

function catalogCandidates(vertexId: string): string[] {
  const raw = vertexId.trim()
  const out = new Set<string>()
  const add = (value: string) => {
    const v = value.trim()
    if (v) out.add(v)
  }

  add(raw)
  add(normalizeVertexModelIdForCatalog(raw))

  const normalized = normalizeVertexModelIdForCatalog(raw)
  add(normalized)

  for (const id of [normalized, raw]) {
    const withoutNumeric = id.replace(/-(\d{3})$/, '')
    if (withoutNumeric !== id) add(withoutNumeric)
    const withoutAt = id.replace(/@(\d+)$/, '')
    if (withoutAt !== id) add(withoutAt)
    if (id.endsWith('-maas')) add(id.replace(/-maas$/, ''))
    else add(`${id}-maas`)
  }

  return [...out]
}

function findFamilyCatalogModel(normalizedId: string): CatalogModel | undefined {
  const candidates = MODEL_CATALOG.filter(
    (m) => m.id !== AUTO_MODEL_ID && m.id !== MAX_MODEL_ID,
  ).sort((a, b) => b.id.length - a.id.length)

  for (const model of candidates) {
    if (normalizedId === model.id) return model
    if (
      normalizedId.startsWith(`${model.id}-`) ||
      normalizedId.startsWith(`${model.id}@`) ||
      normalizedId.startsWith(`${model.id}.`)
    ) {
      return model
    }
  }
  return undefined
}

/**
 * Resuelve metadatos y precio de catálogo para un modelo listado en Vertex.
 * Prioriza coincidencia exacta con precio; si no, prefijo/familia (p. ej. gemini-2.5-flash-001 → gemini-2.5-flash).
 */
export function resolveCatalogModelForVertexId(
  vertexId: string,
): ResolvedVertexCatalogModel | null {
  const raw = vertexId.trim()
  if (!raw) return null

  let exactWithoutPricing: CatalogModel | undefined
  let aliasMatch: CatalogModel | undefined

  for (const candidateId of catalogCandidates(raw)) {
    if (VERTEX_TO_CATALOG_ALIASES[vertexId.trim()] === candidateId ||
      VERTEX_TO_CATALOG_ALIASES[normalizeVertexModelIdForCatalog(raw)] === candidateId) {
      const model = getCatalogModel(candidateId)
      if (model) aliasMatch = model
    }

    const model = getCatalogModel(candidateId)
    if (!model) continue
    if (hasUsablePricing(model.pricing)) {
      const match: CatalogVertexMatchKind =
        candidateId === raw || candidateId === normalizeVertexModelIdForCatalog(raw)
          ? 'exact'
          : 'alias'
      return { model, match, catalogId: model.id }
    }
    if (!exactWithoutPricing) exactWithoutPricing = model
  }

  const normalized = normalizeVertexModelIdForCatalog(raw)
  const family = findFamilyCatalogModel(normalized)
  if (family && hasUsablePricing(family.pricing)) {
    return { model: family, match: 'family', catalogId: family.id }
  }

  if (aliasMatch) {
    return {
      model: aliasMatch,
      match: 'alias',
      catalogId: aliasMatch.id,
    }
  }

  if (exactWithoutPricing) {
    return {
      model: exactWithoutPricing,
      match: 'exact',
      catalogId: exactWithoutPricing.id,
    }
  }

  if (family) {
    return { model: family, match: 'family', catalogId: family.id }
  }

  return null
}

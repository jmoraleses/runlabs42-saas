import {
  DEFAULT_IMAGE_GEN_MODEL,
  isImagenModelId,
} from '@/lib/ai/constants'
import { MODEL_CATALOG, type CatalogModel } from '@/lib/ai/catalog'

/** Modelos de imagen GA (estables) disponibles en Vertex. */
export function listStableImageModels(): CatalogModel[] {
  return MODEL_CATALOG.filter(
    (m) => m.category === 'image' && m.status === 'ga' && m.enabled,
  ).sort((a, b) => a.latencyRank - b.latencyRank)
}

export function isStableImageModelId(modelId: string): boolean {
  return listStableImageModels().some((m) => m.id === modelId)
}

/** Valida un id de modelo de imagen; cae al estable por defecto si no es GA. */
export function resolveStableImageModelId(modelId: string | undefined | null): string {
  const trimmed = modelId?.trim()
  if (trimmed && isStableImageModelId(trimmed)) return trimmed
  return DEFAULT_IMAGE_GEN_MODEL
}

function mapImageModelsForClient(models: CatalogModel[]) {
  return models.map(({ id, labelKey, provider, tier, pricing, status }) => ({
    id,
    labelKey,
    provider,
    tier,
    perImage: pricing.perImage ?? null,
    status,
    kind: isImagenModelId(id) ? ('imagen' as const) : ('nano-banana' as const),
  }))
}

export function listStableImageModelsForClient() {
  return mapImageModelsForClient(listStableImageModels())
}

/** Menú del icono imagen en Studio: solo Imagen GA (sin Nano Banana / Gemini image). */
export function listSelectableImageModelsForClient() {
  const imagen = listStableImageModels()
    .filter((m) => isImagenModelId(m.id))
    .sort((a, b) => (a.pricing.perImage ?? Infinity) - (b.pricing.perImage ?? Infinity))
  return mapImageModelsForClient(imagen)
}

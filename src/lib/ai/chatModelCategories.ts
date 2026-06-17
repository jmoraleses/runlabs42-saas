import {
  hasConfiguredModelMenuVisibility,
  inferModelMenuBuckets,
  mapVisibilityIdsToChatCatalogIds,
  type ModelMenuVisibility,
} from '@/lib/ai/modelMenuVisibility'
import { getCatalogModel, modelPriceSortKey } from '@/lib/ai/catalog'

export type ChatModelCategory = 'code' | 'image'

/** Orden en el menú flotante del chat: Código e Imagen. */
export const CHAT_MODEL_CATEGORY_ORDER: ChatModelCategory[] = ['code', 'image']

export function mapVisibilityBucketsToChatCatalog(
  visibility: ModelMenuVisibility,
): ModelMenuVisibility {
  return {
    language: [...mapVisibilityIdsToChatCatalogIds(visibility.language)],
    coding: [...mapVisibilityIdsToChatCatalogIds(visibility.coding)],
    ocr: [...mapVisibilityIdsToChatCatalogIds(visibility.ocr)],
  }
}

function inferSingleChatModelCategory(modelId: string): ChatModelCategory {
  const buckets = inferModelMenuBuckets(modelId)
  if (buckets.length === 1 && buckets[0] === 'ocr') return 'image'
  if (buckets.includes('coding') && !buckets.includes('language')) return 'code'
  if (buckets.includes('ocr') && !buckets.includes('language') && !buckets.includes('coding')) {
    return 'image'
  }
  if (buckets.includes('coding')) return 'code'
  return 'code'
}

/**
 * Categorías del menú Studio según buckets admin.
 * Con visibilidad configurada: solo buckets donde el modelo está marcado (puede repetirse en varias).
 */
export function resolveChatModelCategories(
  modelId: string,
  visibility?: ModelMenuVisibility | null,
): ChatModelCategory[] {
  if (hasConfiguredModelMenuVisibility(visibility)) {
    const cats: ChatModelCategory[] = []
    if (visibility!.coding.includes(modelId)) cats.push('code')
    if (visibility!.ocr.includes(modelId)) cats.push('image')
    if (visibility!.language.includes(modelId)) cats.push('code')
    return [...new Set(cats)]
  }
  return [inferSingleChatModelCategory(modelId)]
}

/** Categoría principal (primera) para compatibilidad con selectores simples. */
export function resolveChatModelCategory(
  modelId: string,
  visibility?: ModelMenuVisibility | null,
): ChatModelCategory {
  return resolveChatModelCategories(modelId, visibility)[0] ?? 'code'
}

export function priceSortKeyForModelId(modelId: string): number {
  const cat = getCatalogModel(modelId)
  return cat ? modelPriceSortKey(cat) : Number.POSITIVE_INFINITY
}

export function groupOptionsByChatCategory<
  T extends {
    id: string
    menuCategory?: ChatModelCategory
    menuCategories?: ChatModelCategory[]
    priceSortKey: number
  },
>(options: T[]): Record<ChatModelCategory, T[]> {
  const grouped: Record<ChatModelCategory, T[]> = { code: [], image: [] }
  for (const opt of options) {
    const categories =
      opt.menuCategories && opt.menuCategories.length > 0
        ? opt.menuCategories
        : [opt.menuCategory ?? 'code']
    for (const cat of categories) {
      grouped[cat].push(opt)
    }
  }
  for (const key of CHAT_MODEL_CATEGORY_ORDER) {
    grouped[key].sort((a, b) => a.priceSortKey - b.priceSortKey || a.id.localeCompare(b.id))
  }
  return grouped
}

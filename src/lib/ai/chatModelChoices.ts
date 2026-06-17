import {
  CHAT_MODEL_CATEGORY_ORDER,
  type ChatModelCategory,
} from '@/lib/ai/chatModelCategories'
import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/modelTypes'

export type { ChatModelCategory }

export type CategoryModelChoices = Record<ChatModelCategory, string>

export type ChatModelSelectionMode = 'auto' | 'max' | 'custom'

export type ChatModelSelection = {
  mode: ChatModelSelectionMode
  categories: CategoryModelChoices
}

export const STORAGE_KEY_MODEL_SELECTION = 'sk.aiModelSelection'
export const LEGACY_STORAGE_KEY_MODEL_CHOICE = 'sk.aiModelChoice'

export const EMPTY_CATEGORY_CHOICES: CategoryModelChoices = {
  code: '',
  image: '',
}

export function createEmptySelection(): ChatModelSelection {
  return { mode: 'auto', categories: { ...EMPTY_CATEGORY_CHOICES } }
}

export function isGlobalModelMode(id: string): id is 'auto' | 'max' {
  return id === AUTO_MODEL_ID || id === MAX_MODEL_ID
}

function migrateLegacyTextCategory(raw: Record<string, unknown>): CategoryModelChoices {
  const categories = { ...EMPTY_CATEGORY_CHOICES }
  for (const key of CHAT_MODEL_CATEGORY_ORDER) {
    const v = raw[key]
    if (typeof v === 'string') categories[key] = v.trim()
  }
  const legacyText = raw.text
  if (typeof legacyText === 'string' && legacyText.trim() && !categories.code) {
    categories.code = legacyText.trim()
  }
  return categories
}

export function parseChatModelSelection(raw: string | null): ChatModelSelection | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ChatModelSelection>
    if (!parsed || typeof parsed !== 'object') return null
    const mode = parsed.mode
    if (mode !== 'auto' && mode !== 'max' && mode !== 'custom') return null
    const categories =
      parsed.categories && typeof parsed.categories === 'object'
        ? migrateLegacyTextCategory(parsed.categories as Record<string, unknown>)
        : { ...EMPTY_CATEGORY_CHOICES }
    return { mode, categories }
  } catch {
    return null
  }
}

export function serializeChatModelSelection(selection: ChatModelSelection): string {
  return JSON.stringify(selection)
}

export function legacyChoiceToSelection(choice: string): ChatModelSelection {
  const trimmed = choice.trim()
  if (trimmed === AUTO_MODEL_ID) return { mode: 'auto', categories: { ...EMPTY_CATEGORY_CHOICES } }
  if (trimmed === MAX_MODEL_ID) return { mode: 'max', categories: { ...EMPTY_CATEGORY_CHOICES } }
  return {
    mode: 'custom',
    categories: { code: trimmed, image: '' },
  }
}

/** Valor legacy para APIs que esperan un único `model`. */
export function effectiveModelChoice(selection: ChatModelSelection): string {
  if (selection.mode === 'auto') return AUTO_MODEL_ID
  if (selection.mode === 'max') return MAX_MODEL_ID
  return selection.categories.code || selection.categories.image || AUTO_MODEL_ID
}

export function getCategoryModelId(
  selection: ChatModelSelection,
  category: ChatModelCategory,
): string {
  if (selection.mode !== 'custom') return ''
  return selection.categories[category] ?? ''
}

export function categoryModelsForApi(
  selection: ChatModelSelection,
): CategoryModelChoices | undefined {
  if (selection.mode !== 'custom') return undefined
  const out = { ...selection.categories }
  if (!out.code && !out.image) return undefined
  return out
}

export function setCategoryModel(
  selection: ChatModelSelection,
  category: ChatModelCategory,
  modelId: string,
): ChatModelSelection {
  return {
    mode: 'custom',
    categories: { ...selection.categories, [category]: modelId },
  }
}

export function setGlobalModelMode(
  selection: ChatModelSelection,
  mode: 'auto' | 'max',
): ChatModelSelection {
  return { ...selection, mode }
}

export function pickDefaultCategoryChoices(
  availableByCategory: Record<ChatModelCategory, string[]>,
  current?: Partial<CategoryModelChoices>,
): CategoryModelChoices {
  const next = { ...EMPTY_CATEGORY_CHOICES }
  for (const category of CHAT_MODEL_CATEGORY_ORDER) {
    const ids = availableByCategory[category] ?? []
    const preferred = current?.[category]?.trim()
    if (preferred && ids.includes(preferred)) {
      next[category] = preferred
    } else {
      next[category] = ids[0] ?? ''
    }
  }
  return next
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import {
  AI_MODEL_OPTIONS,
  AUTO_MODEL_ID,
  MAX_MODEL_ID,
  isValidModelChoice,
} from '@/lib/ai/models'
import {
  formatModelPriceDisplay,
  MODEL_CATALOG,
  modelPriceSortKey,
  type ModelPricing,
} from '@/lib/ai/catalog'
import {
  CHAT_MODEL_CATEGORY_ORDER,
  groupOptionsByChatCategory,
  priceSortKeyForModelId,
  resolveChatModelCategories,
  type ChatModelCategory,
} from '@/lib/ai/chatModelCategories'
import {
  categoryModelsForApi,
  createEmptySelection,
  effectiveModelChoice,
  legacyChoiceToSelection,
  LEGACY_STORAGE_KEY_MODEL_CHOICE,
  parseChatModelSelection,
  pickDefaultCategoryChoices,
  serializeChatModelSelection,
  setCategoryModel,
  setGlobalModelMode,
  STORAGE_KEY_MODEL_SELECTION,
  type CategoryModelChoices,
  type ChatModelSelection,
  type ChatModelSelectionMode,
} from '@/lib/ai/chatModelChoices'
import type { ModelMenuVisibility } from '@/lib/ai/modelMenuVisibility'
import { useApp } from '@/components/app/shell'

type ApiModelRow = {
  id: string
  labelKey: string
  enabled: boolean
  pricing?: ModelPricing
  freeTier?: boolean
}

function loadStoredSelection(): ChatModelSelection {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MODEL_SELECTION)
    const parsed = parseChatModelSelection(stored)
    if (parsed) return parsed
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY_MODEL_CHOICE)
    if (legacy && isValidModelChoice(legacy)) return legacyChoiceToSelection(legacy)
  } catch {
    /* ignore */
  }
  return createEmptySelection()
}

function persistSelection(selection: ChatModelSelection) {
  try {
    localStorage.setItem(STORAGE_KEY_MODEL_SELECTION, serializeChatModelSelection(selection))
    localStorage.setItem(LEGACY_STORAGE_KEY_MODEL_CHOICE, effectiveModelChoice(selection))
  } catch {
    /* ignore */
  }
}

export function useAIModel() {
  const { t } = useApp() as { t: (key: string) => string }
  const [selection, setSelection] = useState<ChatModelSelection>(createEmptySelection)
  const [hydrated, setHydrated] = useState(false)
  const [apiModels, setApiModels] = useState<ApiModelRow[] | null>(null)
  const [visibility, setVisibility] = useState<ModelMenuVisibility | null>(null)
  const [geminiEnabled, setGeminiEnabled] = useState(false)

  useEffect(() => {
    setSelection(loadStoredSelection())
    setHydrated(true)
  }, [])

  useEffect(() => {
    apiFetch<{ models: ApiModelRow[]; geminiEnabled: boolean; visibility?: ModelMenuVisibility }>(
      '/api/ai/models',
    )
      .then((data) => {
        setApiModels(data.models ?? [])
        setVisibility(data.visibility ?? null)
        setGeminiEnabled(!!data.geminiEnabled)
      })
      .catch(() => {
        setApiModels(
          AI_MODEL_OPTIONS.map((m) => {
            const cat = MODEL_CATALOG.find((c) => c.id === m.id)
            return {
              id: m.id,
              labelKey: m.labelKey,
              enabled: m.enabled,
              pricing: cat?.pricing,
              freeTier: cat?.pricing?.freeTier,
            }
          }),
        )
        setGeminiEnabled(false)
      })
  }, [])

  const options = useMemo(() => {
    const rows: ApiModelRow[] =
      apiModels ??
      AI_MODEL_OPTIONS.map((m) => {
        const cat = MODEL_CATALOG.find((c) => c.id === m.id)
        return {
          id: m.id,
          labelKey: m.labelKey,
          enabled: m.enabled,
          pricing: cat?.pricing,
          freeTier: cat?.pricing?.freeTier,
        }
      })
    return rows
      .map((m) => {
        const pricing = m.pricing ?? { inputPerM: null, outputPerM: null }
        const price = formatModelPriceDisplay(t, { pricing, category: 'text' })
        const catalog = MODEL_CATALOG.find((c) => c.id === m.id)
        const priceSortKey = catalog ? modelPriceSortKey(catalog) : priceSortKeyForModelId(m.id)
        const menuCategories = resolveChatModelCategories(m.id, visibility)
        return {
          id: m.id,
          label: t(m.labelKey),
          enabled: m.enabled,
          showFreeBadge: price.showFreeBadge || m.freeTier,
          priceIn: price.priceIn,
          priceOut: price.priceOut,
          priceNote: price.priceNote,
          priceSortKey,
          menuCategory: menuCategories[0],
          menuCategories,
          latencyRank: catalog?.latencyRank ?? 999,
        }
      })
      .sort((a, b) => {
        if (a.id === AUTO_MODEL_ID) return -1
        if (b.id === AUTO_MODEL_ID) return 1
        if (a.id === MAX_MODEL_ID) return -1
        if (b.id === MAX_MODEL_ID) return 1
        return 0
      })
  }, [apiModels, t, visibility])

  const availableByCategory = useMemo(() => {
    const manual = options.filter((o) => o.id !== AUTO_MODEL_ID && o.id !== MAX_MODEL_ID)
    const grouped = groupOptionsByChatCategory(
      manual.map((o) => ({
        ...o,
        menuCategory: (o.menuCategory ?? 'code') as ChatModelCategory,
        menuCategories: o.menuCategories?.length ? o.menuCategories : undefined,
        priceSortKey: o.priceSortKey ?? Number.POSITIVE_INFINITY,
      })),
    )
    const out: Record<ChatModelCategory, string[]> = { code: [], image: [] }
    for (const category of CHAT_MODEL_CATEGORY_ORDER) {
      out[category] = grouped[category].filter((o) => o.enabled).map((o) => o.id)
    }
    return out
  }, [options])

  useEffect(() => {
    if (!hydrated || !apiModels) return
    setSelection((prev) => {
      if (prev.mode === 'auto' || prev.mode === 'max') return prev
      const defaults = pickDefaultCategoryChoices(availableByCategory, prev.categories)
      const hasAny = CHAT_MODEL_CATEGORY_ORDER.some((c) => defaults[c])
      if (!hasAny) return prev
      const next: ChatModelSelection = { mode: 'custom', categories: defaults }
      if (JSON.stringify(next.categories) === JSON.stringify(prev.categories)) return prev
      persistSelection(next)
      return next
    })
  }, [hydrated, apiModels, availableByCategory])

  const setModelChoice = useCallback((next: string) => {
    setSelection((prev) => {
      let updated: ChatModelSelection
      if (next === AUTO_MODEL_ID) updated = setGlobalModelMode(prev, 'auto')
      else if (next === MAX_MODEL_ID) updated = setGlobalModelMode(prev, 'max')
      else if (isValidModelChoice(next)) {
        updated = setCategoryModel(prev, 'code', next)
      } else updated = prev
      persistSelection(updated)
      return updated
    })
  }, [])

  const setCategoryModelChoice = useCallback((category: ChatModelCategory, modelId: string) => {
    setSelection((prev) => {
      const updated = setCategoryModel(prev, category, modelId)
      persistSelection(updated)
      return updated
    })
  }, [])

  const categoryChoices: CategoryModelChoices = selection.categories
  const selectionMode: ChatModelSelectionMode = selection.mode
  const modelChoice = effectiveModelChoice(selection)

  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])

  const selectedLabel = useMemo(() => {
    if (selection.mode === 'max') return t('ed.modelMax')
    if (selection.mode === 'auto') return t('ed.modelAuto')
    const hasCategoryPick = CHAT_MODEL_CATEGORY_ORDER.some((c) => Boolean(categoryChoices[c]))
    if (hasCategoryPick) return t('chat.modelMenu.modelsPill')
    const fallback = options.find((o) => o.id === modelChoice)
    return fallback?.label ?? t('chat.modelMenu.modelsPill')
  }, [selection.mode, categoryChoices, options, modelChoice, t])

  return {
    modelChoice,
    categoryChoices,
    categoryModels: categoryModelsForApi(selection),
    selectionMode,
    setModelChoice,
    setCategoryModelChoice,
    options,
    geminiEnabled,
    selectedLabel,
    hydrated,
  }
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { DEFAULT_IMAGE_GEN_MODEL } from '@/lib/ai/constants'
import { useApp } from '@/components/app/shell'
import {
  readDesignImageModelPref,
  writeDesignImageModelPref,
} from '@/lib/design/designImageModelPref'

export type ImageModelOption = {
  id: string
  label: string
  perImage: string | null
  kind: 'imagen' | 'nano-banana'
}

type ApiImageModelRow = {
  id: string
  labelKey: string
  perImage: number | null
  kind: 'imagen' | 'nano-banana'
}

function formatPerImage(t: (key: string) => string, perImage: number | null): string | null {
  if (perImage == null) return null
  return t('ed.pricePerImage').replace('{price}', `$${perImage.toFixed(3)}`)
}

export function useImageModel() {
  const { t } = useApp() as { t: (key: string) => string }
  const [choice, setChoice] = useState(DEFAULT_IMAGE_GEN_MODEL)
  const [apiModels, setApiModels] = useState<ApiImageModelRow[] | null>(null)
  const [adminDefaultId, setAdminDefaultId] = useState(DEFAULT_IMAGE_GEN_MODEL)
  const [generationEnabled, setGenerationEnabled] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    apiFetch<{
      imageModels?: ApiImageModelRow[]
      defaultImageModelId?: string
      designImageGenerationEnabled?: boolean
    }>('/api/ai/models')
      .then((data) => {
        const rows = data.imageModels ?? []
        setApiModels(rows)
        const defaultId = data.defaultImageModelId?.trim() || DEFAULT_IMAGE_GEN_MODEL
        setAdminDefaultId(defaultId)
        setGenerationEnabled(data.designImageGenerationEnabled !== false)

        const ids = new Set(rows.map((m) => m.id))
        const stored = readDesignImageModelPref()
        const initial =
          stored && ids.has(stored) ? stored : ids.has(defaultId) ? defaultId : rows[0]?.id ?? defaultId
        setChoice(initial)
        setHydrated(true)
      })
      .catch(() => {
        setApiModels([])
        setHydrated(true)
      })
  }, [])

  const setImageModelChoice = useCallback((next: string) => {
    setChoice(next)
    writeDesignImageModelPref(next)
  }, [])

  const options = useMemo((): ImageModelOption[] => {
    const rows = apiModels ?? []
    return rows.map((m) => ({
      id: m.id,
      label: t(m.labelKey),
      perImage: formatPerImage(t, m.perImage),
      kind: m.kind,
    }))
  }, [apiModels, t])

  const selectedOption = options.find((o) => o.id === choice) ?? options[0]

  return {
    imageModelChoice: choice,
    setImageModelChoice,
    options,
    adminDefaultImageModelId: adminDefaultId,
    designImageGenerationEnabled: generationEnabled,
    hydrated,
    selectedLabel: selectedOption?.label ?? choice,
  }
}

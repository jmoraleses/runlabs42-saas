'use client'

import { useCallback, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import type { CategoryModelChoices } from '@/lib/ai/chatModelChoices'

type UseImprovePromptArgs = {
  getText: () => string
  setText: (text: string) => void
  modelChoice?: string
  categoryModels?: CategoryModelChoices
  loading?: boolean
  disabled?: boolean
  onError?: (message: string | null) => void
}

export function useImprovePrompt({
  getText,
  setText,
  modelChoice,
  categoryModels,
  loading,
  disabled,
  onError,
}: UseImprovePromptArgs) {
  const [improvingPrompt, setImprovingPrompt] = useState(false)

  const handleImprovePrompt = useCallback(async () => {
    const text = getText().trim()
    if (!text || improvingPrompt || loading || disabled) return
    setImprovingPrompt(true)
    onError?.(null)
    try {
      const res = await apiFetch<{ improved: string }>('/api/improve-prompt', {
        method: 'POST',
        body: JSON.stringify({
          prompt: text,
          model: modelChoice ?? 'auto',
          ...(categoryModels ? { categoryModels } : {}),
        }),
      })
      if (res.improved) {
        setText(res.improved)
      }
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'No se pudo mejorar el prompt')
    } finally {
      setImprovingPrompt(false)
    }
  }, [getText, setText, improvingPrompt, loading, disabled, modelChoice, categoryModels, onError])

  return {
    improvingPrompt,
    handleImprovePrompt,
    canImprovePrompt: Boolean(getText().trim()),
  }
}

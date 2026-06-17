'use client'

import React, { useMemo } from 'react'
import { useApp } from '@/components/app/shell'
import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/models'

export type AIModelSelectOption = {
  id: string
  label: string
  enabled: boolean
  showFreeBadge?: boolean
  priceIn?: string | null
  priceOut?: string | null
  priceNote?: string | null
  /** @deprecated Usar priceIn/priceOut/priceNote */
  priceLine?: string | null
  menuCategory?: 'code' | 'image'
  /** Buckets admin: un modelo puede aparecer en varias secciones del menú. */
  menuCategories?: ('code' | 'image')[]
  priceSortKey?: number
}

type AIModelPickerProps = {
  value: string
  options: AIModelSelectOption[]
  onChange: (modelId: string) => void
  disabled?: boolean
  id?: string
}

/** Selector de modelo en el pie del chat: checkbox Auto + lista de modelos concretos. */
export function AIModelPicker({
  value,
  options,
  onChange,
  disabled = false,
  id = 'ai-model-picker',
}: AIModelPickerProps) {
  const { t } = useApp() as { t: (key: string) => string }

  const manualOptions = useMemo(
    () => options.filter((o) => o.id !== AUTO_MODEL_ID && o.id !== MAX_MODEL_ID),
    [options],
  )

  const isAuto = value === AUTO_MODEL_ID
  const firstEnabledManual =
    manualOptions.find((o) => o.enabled)?.id ?? manualOptions[0]?.id ?? AUTO_MODEL_ID

  function onAutoChange(checked: boolean) {
    if (checked) {
      onChange(AUTO_MODEL_ID)
    } else {
      const manual = manualOptions.find((o) => o.id === value && o.id !== AUTO_MODEL_ID)
      onChange(manual?.enabled ? manual.id : firstEnabledManual)
    }
  }

  return (
    <div className="editor-ai-model-picker">
      <label className="editor-auto-model-toggle" title={t('ed.modelAutoHint')}>
        <input
          type="checkbox"
          checked={isAuto}
          disabled={disabled}
          onChange={(e) => onAutoChange(e.target.checked)}
        />
        <span className="editor-auto-model-toggle__track" aria-hidden />
        <span className="editor-auto-model-toggle__label">{t('ed.modelAutoShort')}</span>
      </label>

      {!isAuto && manualOptions.length > 0 && (
        <select
          id={id}
          className="editor-ai-model-select editor-ai-model-select--inline"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t('ed.model')}
        >
          {manualOptions.map((opt) => (
            <option key={opt.id} value={opt.id} disabled={!opt.enabled}>
              {opt.label}
              {!opt.enabled ? ` (${t('ed.modelSoon')})` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

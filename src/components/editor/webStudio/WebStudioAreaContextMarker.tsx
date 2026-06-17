'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import { formatPinAreaLabel, pinAreaWithDefaults } from '@/lib/visual-edit/canvasPinArea'
import type { CanvasPin } from '@/lib/visual-edit/canvasPins'

type WebStudioAreaContextMarkerProps = {
  pin: CanvasPin
  onRemove: () => void
}

export function WebStudioAreaContextMarker({ pin, onRemove }: WebStudioAreaContextMarkerProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const area = pinAreaWithDefaults(pin)
  const coords = `${area.xPercent.toFixed(0)}%, ${area.yPercent.toFixed(0)}%`
  const pinKind = pin.kind ?? 'area'
  const label = pin.label ?? (pinKind === 'image' ? 'img' : 'area')
  const description = pin.description.trim()
  const title = description
    ? `${label} · ${formatPinAreaLabel(area)} · ${coords} — ${description}`
    : `${label} · ${formatPinAreaLabel(area)} · ${coords}`

  return (
    <div
      className={`web-studio-context-marker web-studio-context-marker--label-only web-studio-context-marker--pin-${pinKind}`}
      role="status"
      title={title}
    >
      <span className="web-studio-context-marker__badge web-studio-context-marker__badge--label">
        {label}
      </span>
      <button
        type="button"
        className="web-studio-context-marker__remove"
        onClick={onRemove}
        aria-label={t('ed.webStudio.areaContextRemove')}
      >
        ×
      </button>
    </div>
  )
}

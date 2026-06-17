'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import {
  elementContextMarkerDetail,
  elementContextMarkerLabel,
  type DesignElementContextPin,
} from '@/lib/design/elementContext'

type WebStudioElementContextMarkerProps = {
  pin: DesignElementContextPin
  onRemove: () => void
}

export function WebStudioElementContextMarker({
  pin,
  onRemove,
}: WebStudioElementContextMarkerProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const label = elementContextMarkerLabel(pin)
  const title = elementContextMarkerDetail(pin)

  return (
    <div
      className="web-studio-context-marker web-studio-context-marker--element web-studio-context-marker--label-only"
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
        aria-label={t('ed.webStudio.elementContextRemove')}
      >
        ×
      </button>
    </div>
  )
}

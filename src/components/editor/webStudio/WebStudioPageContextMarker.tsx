'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import { WsIcon } from '@/components/editor/webStudio/WebStudioIcons'
import {
  pageContextMarkerDetail,
  pageContextMarkerLabel,
  type DesignPageContextPin,
} from '@/lib/design/elementContext'

type WebStudioPageContextMarkerProps = {
  pin: DesignPageContextPin
  onRemove: () => void
}

export function WebStudioPageContextMarker({ pin, onRemove }: WebStudioPageContextMarkerProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const label = pageContextMarkerLabel(pin)
  const detail = pageContextMarkerDetail(pin)

  return (
    <div className="web-studio-context-marker web-studio-context-marker--page" role="status">
      <span className="web-studio-context-marker__icon" aria-hidden>
        <WsIcon.Cursor size={14} />
      </span>
      <span className="web-studio-context-marker__text" title={detail}>
        {label}
      </span>
      <button
        type="button"
        className="web-studio-context-marker__remove"
        onClick={onRemove}
        aria-label={t('ed.webStudio.pageContextRemove')}
      >
        ×
      </button>
    </div>
  )
}

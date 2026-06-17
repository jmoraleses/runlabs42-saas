'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import type { CanvasPin } from '@/lib/visual-edit/canvasPins'

type ChatCanvasPinChipsProps = {
  pins: CanvasPin[]
  onRemove?: (id: string) => void
  readOnly?: boolean
}

export function ChatCanvasPinChips({ pins, onRemove, readOnly }: ChatCanvasPinChipsProps) {
  const { t } = useApp() as { t: (key: string) => string }
  if (!pins.length) return null

  return (
    <div className="chat-context-chips chat-pin-chips" aria-label={t('chat.pins.attached')}>
      {pins.map((pin, index) => {
        const label = pin.description.trim()
        const short = label.length > 36 ? `${label.slice(0, 36)}…` : label
        return (
          <span key={pin.id} className="chat-context-chip chat-pin-chip" title={label}>
            <span className="chat-pin-chip__badge" aria-hidden>
              {index + 1}
            </span>
            {short || t('chat.pins.unnamed')}
            {!readOnly && onRemove ? (
              <button
                type="button"
                className="chat-context-chip__remove"
                onClick={() => onRemove(pin.id)}
                aria-label={t('chat.pins.remove').replace('{n}', String(index + 1))}
              >
                ×
              </button>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}

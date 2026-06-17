'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { formatPinAreaLabel, pinAreaWithDefaults } from '@/lib/visual-edit/canvasPinArea'
import type { CanvasPin } from '@/lib/visual-edit/canvasPins'

type CanvasPinCommentDockProps = {
  pins: CanvasPin[]
  draftOpen: boolean
  draftIndex: number
  draftLocationLabel?: string
  onCommit: (description: string) => void
  onCancelDraft: () => void
  onRemovePin: (id: string) => void
  onDone: () => void
  className?: string
}

export function CanvasPinCommentDock({
  pins,
  draftOpen,
  draftIndex,
  draftLocationLabel,
  onCommit,
  onCancelDraft,
  onRemovePin,
  onDone,
  className,
}: CanvasPinCommentDockProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (draftOpen) {
      setValue('')
      inputRef.current?.focus()
    }
  }, [draftOpen, draftIndex])

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onCommit(trimmed)
    setValue('')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancelDraft()
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      className={`editor-pin-dock${className ? ` ${className}` : ''}`}
      role="region"
      aria-labelledby={titleId}
    >
      <header className="editor-pin-dock__head">
        <div className="editor-pin-dock__title-wrap">
          <span className="editor-pin-dock__icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v6M8 10h8M12 10v12" />
              <circle cx="12" cy="5" r="2.5" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div>
            <h3 id={titleId} className="editor-pin-dock__title">
              {t('ed.pinDockTitle')}
            </h3>
            <p className="editor-pin-dock__subtitle">
              {pins.length
                ? t('ed.pinDockCount').replace('{n}', String(pins.length))
                : t('ed.pinDockEmpty')}
            </p>
          </div>
        </div>
        <button type="button" className="editor-pin-dock__done" onClick={onDone}>
          {t('ed.pinDockDone')}
        </button>
      </header>

      {pins.length > 0 ? (
        <ul className="editor-pin-dock__list">
          {pins.map((pin, index) => {
            const area = pinAreaWithDefaults(pin)
            return (
            <li key={pin.id} className="editor-pin-dock__item">
              <span className="editor-pin-dock__item-num">{index + 1}</span>
              <span className="editor-pin-dock__item-text" title={pin.description}>
                <span className="editor-pin-dock__item-area mono">{formatPinAreaLabel(area)}</span>
                {pin.description}
              </span>
              <button
                type="button"
                className="editor-pin-dock__item-remove"
                onClick={() => onRemovePin(pin.id)}
                aria-label={t('chat.pins.remove').replace('{n}', String(index + 1))}
              >
                ×
              </button>
            </li>
            )
          })}
        </ul>
      ) : null}

      {draftOpen ? (
        <div className="editor-pin-dock__form" role="dialog" aria-label={t('ed.pinEditTitle')}>
          <div className="editor-pin-dock__form-head">
            <span className="editor-pin-dock__form-badge">{draftIndex}</span>
            <div>
              <p className="editor-pin-dock__form-label">{t('ed.pinEditTitle')}</p>
              {draftLocationLabel ? (
                <p className="editor-pin-dock__form-meta mono">{draftLocationLabel}</p>
              ) : null}
            </div>
          </div>
          <textarea
            ref={inputRef}
            className="editor-pin-dock__textarea"
            rows={2}
            value={value}
            placeholder={t('ed.pinEditPlaceholder')}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={t('ed.pinEditPlaceholder')}
          />
          <div className="editor-pin-dock__form-actions">
            <button type="button" className="editor-pin-dock__btn editor-pin-dock__btn--ghost" onClick={onCancelDraft}>
              {t('ed.pinCancelSpot')}
            </button>
            <button
              type="button"
              className="editor-pin-dock__btn editor-pin-dock__btn--primary"
              onClick={submit}
              disabled={!value.trim()}
            >
              {t('ed.pinEditAdd')}
            </button>
          </div>
        </div>
      ) : (
        <p className="editor-pin-dock__hint">{t('ed.tool.placeHintPin')}</p>
      )}
    </div>
  )
}

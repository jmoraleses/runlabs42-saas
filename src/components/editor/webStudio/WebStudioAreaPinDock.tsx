'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'

export type WebStudioPinDockTone = 'area' | 'image' | 'element'

type WebStudioAreaPinDockProps = {
  label: string
  locationLabel?: string
  placeholder?: string
  titleKey?: string
  tone?: WebStudioPinDockTone
  initialDescription?: string
  commitLabelKey?: string
  onCommit: (description: string) => void
  onCancel: () => void
}

export function WebStudioAreaPinDock({
  label,
  locationLabel,
  placeholder,
  titleKey = 'ed.pinEditTitle',
  tone = 'area',
  initialDescription = '',
  commitLabelKey = 'ed.pinEditAdd',
  onCommit,
  onCancel,
}: WebStudioAreaPinDockProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()

  useEffect(() => {
    setValue(initialDescription)
    const el = inputRef.current
    el?.focus()
    if (initialDescription && el) {
      el.setSelectionRange(0, initialDescription.length)
    }
  }, [label, locationLabel, initialDescription])

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onCommit(trimmed)
    setValue('')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      className={`editor-pin-dock editor-pin-dock--web-studio editor-pin-dock--draft-only editor-pin-dock--${tone}`}
      role="dialog"
      aria-labelledby={titleId}
    >
      <header className="editor-pin-dock__head">
        <div className="editor-pin-dock__title-wrap">
          <span className="editor-pin-dock__form-badge editor-pin-dock__form-badge--title">{label}</span>
          <div>
            <h3 id={titleId} className="editor-pin-dock__title">
              {t(titleKey)}
            </h3>
            {locationLabel ? (
              <p className="editor-pin-dock__form-meta mono">{locationLabel}</p>
            ) : null}
          </div>
        </div>
      </header>
      <textarea
        ref={inputRef}
        className="editor-pin-dock__textarea"
        rows={2}
        value={value}
        placeholder={placeholder ?? t('ed.pinEditPlaceholder')}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label={placeholder ?? t('ed.pinEditPlaceholder')}
      />
      <div className="editor-pin-dock__form-actions">
        <button type="button" className="editor-pin-dock__btn editor-pin-dock__btn--ghost" onClick={onCancel}>
          {t('ed.pinCancelSpot')}
        </button>
        <button
          type="button"
          className="editor-pin-dock__btn editor-pin-dock__btn--primary"
          onClick={submit}
          disabled={!value.trim()}
        >
          {t(commitLabelKey)}
        </button>
      </div>
    </div>
  )
}

'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { Icon, useApp } from '@/components/app/shell'
import { SpeechDictationButton } from '@/components/common/SpeechDictationButton'

type Position = { top: number; left: number; width: number; height: number }

export type ElementEditVariant = 'text' | 'ai'

type ElementTextEditOverlayProps = {
  variant?: ElementEditVariant
  position: Position
  initialText?: string
  elementLabel?: string
  title?: string
  placeholder?: string
  onCommit: (value: string) => void
  onCancel: () => void
  /** Misma posición que la barra «Editar elemento» si el usuario la arrastró. */
  dockPosition?: { x: number; y: number } | null
}

function panelPlacementText(position: Position) {
  const width = Math.min(360, Math.max(280, position.width))
  const top = position.top + position.height + 10
  const left = Math.max(
    12,
    Math.min(position.left, typeof window !== 'undefined' ? window.innerWidth - width - 24 : position.left),
  )
  return { top, left, width }
}

export function ElementTextEditOverlay({
  variant = 'text',
  position,
  initialText = '',
  elementLabel,
  title,
  placeholder,
  onCommit,
  onCancel,
  dockPosition = null,
}: ElementTextEditOverlayProps) {
  const { t, speechDictationEnabled } = useApp() as {
    t: (key: string) => string
    speechDictationEnabled?: boolean
  }
  const [value, setValue] = useState(initialText)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const isAi = variant === 'ai'
  const place = isAi ? null : panelPlacementText(position)

  useEffect(() => {
    setValue(initialText)
    inputRef.current?.focus()
    if (!isAi) inputRef.current?.select()
  }, [initialText, isAi])

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onCommit(trimmed)
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

  if (isAi) {
    const dockFree = Boolean(dockPosition)
    const dockStyle: React.CSSProperties | undefined = dockFree
      ? {
          bottom: 'auto',
          right: 'auto',
          left: dockPosition!.x,
          top: dockPosition!.y,
          transform: 'none',
        }
      : undefined

    return (
      <div
        className={`editor-edit-popover editor-edit-popover--ai editor-edit-popover--dock${dockFree ? ' editor-edit-popover--dock-free' : ''}`}
        style={dockStyle}
        role="dialog"
        aria-labelledby={titleId}
      >
        <header className="editor-edit-popover-head editor-edit-popover-head--compact">
          <span className="editor-edit-popover-icon" aria-hidden>
            <Icon.Spark />
          </span>
          <span id={titleId} className="editor-edit-popover-title">
            {title ?? t('ed.aiEdit')}
          </span>
          {elementLabel ? (
            <span className="editor-edit-popover-tag mono">{elementLabel}</span>
          ) : null}
        </header>

        <div className="editor-edit-popover-input-row">
          <input
            ref={inputRef}
            className="editor-edit-popover-field editor-edit-popover-field--inline"
            value={value}
            placeholder={placeholder ?? t('ed.aiEditPlaceholder')}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={title ?? t('ed.aiEdit')}
          />
          {speechDictationEnabled ? (
            <SpeechDictationButton
              getText={() => value}
              setText={setValue}
              className="editor-edit-popover-speech-btn"
            />
          ) : null}
        </div>

        <div className="editor-edit-popover-actions editor-edit-popover-actions--inline">
          <button type="button" className="editor-edit-popover-btn editor-edit-popover-btn--ghost" onClick={onCancel}>
            {t('ed.cancel')}
          </button>
          <button
            type="button"
            className="editor-edit-popover-btn editor-edit-popover-btn--ai"
            onClick={submit}
            disabled={!value.trim()}
          >
            <Icon.Spark />
            {t('ed.aiEditSend')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        className="editor-edit-popover-backdrop"
        aria-label={t('ed.cancel')}
        onClick={onCancel}
      />
      <div
        className="editor-edit-popover"
        style={{ top: place!.top, left: place!.left, width: place!.width }}
        role="dialog"
        aria-labelledby={titleId}
      >
        <header className="editor-edit-popover-head">
          <span className="editor-edit-popover-icon" aria-hidden>
            <Icon.Pencil />
          </span>
          <span id={titleId} className="editor-edit-popover-title">
            {t('ed.editElement')}
          </span>
          {elementLabel ? (
            <span className="editor-edit-popover-tag mono">{elementLabel}</span>
          ) : null}
        </header>

        <div className="editor-edit-popover-input-row">
          <input
            ref={inputRef}
            className="editor-edit-popover-field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={t('ed.editElement')}
          />
          {speechDictationEnabled ? (
            <SpeechDictationButton
              getText={() => value}
              setText={setValue}
              className="editor-edit-popover-speech-btn"
            />
          ) : null}
        </div>

        <footer className="editor-edit-popover-foot">
          <span className="editor-edit-popover-hint">{t('ed.editTextHint')}</span>
          <div className="editor-edit-popover-actions">
            <button type="button" className="editor-edit-popover-btn editor-edit-popover-btn--ghost" onClick={onCancel}>
              {t('ed.cancel')}
            </button>
            <button
              type="button"
              className="editor-edit-popover-btn editor-edit-popover-btn--primary"
              onClick={submit}
              disabled={!value.trim()}
            >
              {t('ed.apply')}
            </button>
          </div>
        </footer>
      </div>
    </>
  )
}

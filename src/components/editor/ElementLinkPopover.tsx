'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5" />
    <path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.41a5 5 0 0 0 7.07 7.07L14 19" />
  </svg>
)

type Position = { top: number; left: number; width: number; height: number }

type ElementLinkPopoverProps = {
  position: Position
  initialUrl?: string
  onCommit: (url: string) => void
  onCancel: () => void
}

function placementBelowElement(position: Position) {
  const width = Math.min(360, Math.max(280, position.width))
  const top = position.top + position.height + 10
  const left = Math.max(
    12,
    Math.min(position.left, typeof window !== 'undefined' ? window.innerWidth - width - 24 : position.left),
  )
  return { top, left, width }
}

export function ElementLinkPopover({
  position,
  initialUrl = 'https://',
  onCommit,
  onCancel,
}: ElementLinkPopoverProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [value, setValue] = useState(initialUrl)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const place = placementBelowElement(position)

  useEffect(() => {
    setValue(initialUrl)
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [initialUrl])

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
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
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
        className="editor-edit-popover editor-edit-popover--link"
        style={{ top: place.top, left: place.left, width: place.width }}
        role="dialog"
        aria-labelledby={titleId}
      >
        <header className="editor-edit-popover-head">
          <span className="editor-edit-popover-icon" aria-hidden>
            <LinkIcon />
          </span>
          <span id={titleId} className="editor-edit-popover-title">
            {t('ed.link')}
          </span>
        </header>

        <label className="editor-edit-popover-label" htmlFor={`${titleId}-url`}>
          {t('ed.linkUrl')}
        </label>
        <input
          id={`${titleId}-url`}
          ref={inputRef}
          type="url"
          className="editor-edit-popover-field"
          value={value}
          placeholder={t('ed.linkUrlPlaceholder')}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />

        <footer className="editor-edit-popover-foot">
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

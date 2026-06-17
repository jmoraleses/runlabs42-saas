'use client'

import React from 'react'
import { Icon } from '@/components/app/shell'

type EditorPanelCollapseHandleProps = {
  side: 'chat' | 'files'
  open: boolean
  onToggle: () => void
  'aria-label'?: string
  title?: string
}

/** Franja vertical fina para ocultar / mostrar el panel de chat o archivos. */
export function EditorPanelCollapseHandle({
  side,
  open,
  onToggle,
  'aria-label': ariaLabel,
  title,
}: EditorPanelCollapseHandleProps) {
  return (
    <button
      type="button"
      className={`editor-panel-collapse editor-panel-collapse--${side}${open ? ' is-open' : ''}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={ariaLabel}
      title={title}
    >
      <span className="editor-panel-collapse__chevron" aria-hidden>
        <Icon.Chevron />
      </span>
    </button>
  )
}

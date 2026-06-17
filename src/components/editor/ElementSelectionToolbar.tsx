'use client'

import React, { forwardRef } from 'react'
import { Icon, useApp } from '@/components/app/shell'
import type { ElementDescriptor } from '@/lib/visual-edit/protocol'

type OverlayPosition = { top: number; left: number; width: number; height: number }

export type ElementToolbarAction =
  | 'editText'
  | 'aiEdit'
  | 'textStyle'
  | 'italic'
  | 'link'
  | 'align'
  | 'viewCode'
  | 'delete'
  | 'close'
  | 'toggleSelect'

type ElementSelectionToolbarProps = {
  element: ElementDescriptor
  /** @deprecated La barra va anclada arriba a la izquierda del canvas. */
  position?: OverlayPosition
  isItalic?: boolean
  selectionActive?: boolean
  onAction: (action: ElementToolbarAction) => void
  onDragStart?: (e: React.PointerEvent<HTMLDivElement>) => void
  /** Posición libre (no anclada al dock inferior). */
  floating?: boolean
  style?: React.CSSProperties
}

const TbIcon = {
  Type: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </svg>
  ),
  Italic: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M19 4h-9M14 20H5M15 4 9 20" />
    </svg>
  ),
  Link: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.41a5 5 0 0 0 7.07 7.07L14 19" />
    </svg>
  ),
  Align: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M21 6H3M17 12H7M19 18H5" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  ),
}

export const ElementSelectionToolbar = forwardRef<HTMLDivElement, ElementSelectionToolbarProps>(
function ElementSelectionToolbar({
  element,
  isItalic = false,
  selectionActive: _selectionActive = true,
  onAction,
  onDragStart,
  floating = false,
  style,
}, ref) {
  const { t } = useApp() as { t: (key: string) => string }
  const tag = element.skId
    ? `${element.tagName} · ${element.skId}`
    : element.tagName

  return (
    <div
      ref={ref}
      className={`editor-element-toolbar editor-element-toolbar--dock${floating ? ' editor-element-toolbar--free' : ''}`}
      style={style}
    >
      <div
        className="editor-element-toolbar-drag-handle"
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDragStart?.(e)
        }}
        role="button"
        tabIndex={0}
        aria-label={t('ed.toolbarMove')}
        title={t('ed.toolbarMove')}
      />
      <button type="button" className="editor-element-toolbar-primary" onClick={() => onAction('editText')}>
        {t('ed.editElement')}
        <span className="editor-element-toolbar-target mono">{tag}</span>
      </button>
      <span className="editor-element-toolbar-sep" />
      <div className="editor-element-toolbar-actions" role="group">
      <button
        type="button"
        className="editor-element-toolbar-btn"
        onClick={() => onAction('aiEdit')}
        title={t('ed.aiEdit')}
      >
        <Icon.Spark />
      </button>
      <button
        type="button"
        className="editor-element-toolbar-btn"
        onClick={() => onAction('textStyle')}
        title={t('ed.textStyle')}
      >
        <TbIcon.Type />
      </button>
      <button
        type="button"
        className={`editor-element-toolbar-btn${isItalic ? ' is-active' : ''}`}
        onClick={() => onAction('italic')}
        title={t('ed.italic')}
        aria-pressed={isItalic}
      >
        <TbIcon.Italic />
      </button>
      <button
        type="button"
        className="editor-element-toolbar-btn"
        onClick={() => onAction('link')}
        title={t('ed.link')}
      >
        <TbIcon.Link />
      </button>
      <button
        type="button"
        className="editor-element-toolbar-btn"
        onClick={() => onAction('align')}
        title={t('ed.align')}
      >
        <TbIcon.Align />
      </button>
      {element.source && (
        <button
          type="button"
          className="editor-element-toolbar-btn"
          onClick={() => onAction('viewCode')}
          title={t('ed.viewCode')}
        >
          <Icon.Code />
        </button>
      )}
      <button
        type="button"
        className="editor-element-toolbar-btn editor-element-toolbar-btn--danger"
        onClick={() => onAction('delete')}
        title={t('ed.delete')}
      >
        <TbIcon.Trash />
      </button>
      <button
        type="button"
        className="editor-element-toolbar-btn"
        onClick={() => onAction('close')}
        aria-label={t('ed.close')}
      >
        <Icon.X />
      </button>
      </div>
    </div>
  )
})

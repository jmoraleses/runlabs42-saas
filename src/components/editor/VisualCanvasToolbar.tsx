'use client'

import React, { useRef, type RefObject } from 'react'
import { Icon, useApp } from '@/components/app/shell'
import { useDraggableRail } from '@/hooks/useDraggableRail'
import { VisualFontSizeMenu } from '@/components/editor/VisualFontSizeMenu'

export type VisualCanvasEngagedTool = 'select' | 'pin' | null

export type VisualEditToolbarApi = {
  engagedTool: VisualCanvasEngagedTool
  hasSelection: boolean
  isItalic: boolean
  fontSizeOpen: boolean
  currentFontSize?: string
  disabled?: boolean
  boundsRef: RefObject<HTMLElement | null>
  onSelectTool: () => void
  onPinTool: () => void
  onEditText: () => void
  onFontSizeToggle: () => void
  onFontSizeSelect: (size: string) => void
  onFontSizeClose: () => void
  onItalic: () => void
  onLink: () => void
  onAlign: () => void
  onDelete: () => void
  onClose: () => void
}

const TbIcon = {
  Text: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </svg>
  ),
  Size: () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M3 7V5h7M3 17v2h7M21 7V5h-7M21 17v2h-7" />
      <path d="M7 12h10" />
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

function SelectIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 4l7 16 2.5-6.5L20 11 4 4z" strokeLinejoin="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function VisualCanvasToolbar({
  engagedTool,
  hasSelection,
  isItalic,
  fontSizeOpen,
  currentFontSize,
  disabled,
  boundsRef,
  onSelectTool,
  onPinTool,
  onEditText,
  onFontSizeToggle,
  onFontSizeSelect,
  onFontSizeClose,
  onItalic,
  onLink,
  onAlign,
  onDelete,
  onClose,
}: VisualEditToolbarApi) {
  const { t } = useApp() as { t: (key: string) => string }
  const railRef = useRef<HTMLDivElement>(null)
  const { dragging, railStyle, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } =
    useDraggableRail(boundsRef, railRef)

  return (
    <div
      ref={railRef}
      className={`editor-canvas-tool-rail${dragging ? ' is-dragging' : ''}`}
      role="toolbar"
      aria-label={t('ed.tool.railLabel')}
      style={railStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <button
        type="button"
        className={`editor-canvas-tool-rail__btn${engagedTool === 'select' ? ' is-active' : ''}`}
        onClick={onSelectTool}
        disabled={disabled}
        title={t('ed.tool.select')}
        aria-label={t('ed.tool.select')}
        aria-pressed={engagedTool === 'select'}
      >
        <SelectIcon />
      </button>
      <button
        type="button"
        className={`editor-canvas-tool-rail__btn${engagedTool === 'pin' ? ' is-active' : ''}`}
        onClick={onPinTool}
        disabled={disabled}
        title={t('ed.tool.pin')}
        aria-label={t('ed.tool.pin')}
        aria-pressed={engagedTool === 'pin'}
      >
        <PinIcon />
      </button>

      <span className="editor-canvas-tool-rail__sep" aria-hidden />

      <button
        type="button"
        className="editor-canvas-tool-rail__btn"
        onClick={onEditText}
        disabled={disabled || !hasSelection}
        title={t('ed.editText')}
        aria-label={t('ed.editText')}
      >
        <TbIcon.Text />
      </button>
      <div className="editor-canvas-tool-rail__size-wrap">
        <button
          type="button"
          className={`editor-canvas-tool-rail__btn${fontSizeOpen ? ' is-active' : ''}`}
          onClick={onFontSizeToggle}
          disabled={disabled || !hasSelection}
          title={t('ed.fontSize')}
          aria-label={t('ed.fontSize')}
          aria-expanded={fontSizeOpen}
        >
          <TbIcon.Size />
        </button>
        <VisualFontSizeMenu
          open={fontSizeOpen}
          current={currentFontSize}
          onSelect={onFontSizeSelect}
          onClose={onFontSizeClose}
        />
      </div>
      <button
        type="button"
        className={`editor-canvas-tool-rail__btn${isItalic ? ' is-active' : ''}`}
        onClick={onItalic}
        disabled={disabled || !hasSelection}
        title={t('ed.italic')}
        aria-pressed={isItalic}
      >
        <TbIcon.Italic />
      </button>
      <button
        type="button"
        className="editor-canvas-tool-rail__btn"
        onClick={onLink}
        disabled={disabled || !hasSelection}
        title={t('ed.link')}
      >
        <TbIcon.Link />
      </button>
      <button
        type="button"
        className="editor-canvas-tool-rail__btn"
        onClick={onAlign}
        disabled={disabled || !hasSelection}
        title={t('ed.align')}
      >
        <TbIcon.Align />
      </button>
      <button
        type="button"
        className="editor-canvas-tool-rail__btn editor-canvas-tool-rail__btn--danger"
        onClick={onDelete}
        disabled={disabled || !hasSelection}
        title={t('ed.delete')}
      >
        <TbIcon.Trash />
      </button>
      <button
        type="button"
        className="editor-canvas-tool-rail__btn"
        onClick={onClose}
        disabled={disabled}
        aria-label={t('ed.close')}
        title={t('ed.close')}
      >
        <Icon.X />
      </button>
    </div>
  )
}

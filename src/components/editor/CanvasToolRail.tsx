'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import type { InsertNodeKind } from '@/lib/visual-edit/protocol'

export type CanvasToolId =
  | 'select'
  | 'insert-text'
  | 'insert-heading'
  | 'insert-image'
  | 'insert-button'
  | 'insert-section'

type CanvasToolRailProps = {
  /** Herramienta actualmente activa; null = ninguna seleccionada. */
  engagedTool: CanvasToolId | null
  onToolChange: (tool: CanvasToolId) => void
  disabled?: boolean
}

const TOOL_GROUPS: { tools: CanvasToolId[] }[] = [
  { tools: ['select'] },
  { tools: ['insert-text', 'insert-heading', 'insert-image', 'insert-button', 'insert-section'] },
]

export function toolToInsertKind(tool: CanvasToolId): InsertNodeKind | null {
  switch (tool) {
    case 'insert-text':
      return 'text'
    case 'insert-heading':
      return 'heading'
    case 'insert-image':
      return 'image'
    case 'insert-button':
      return 'button'
    case 'insert-section':
      return 'section'
    default:
      return null
  }
}

export function insertKindToTool(kind: InsertNodeKind): CanvasToolId {
  switch (kind) {
    case 'heading':
      return 'insert-heading'
    case 'image':
      return 'insert-image'
    case 'button':
      return 'insert-button'
    case 'section':
      return 'insert-section'
    default:
      return 'insert-text'
  }
}

function ToolIcon({ tool }: { tool: CanvasToolId }) {
  switch (tool) {
    case 'select':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 4l7 16 2.5-6.5L20 11 4 4z" strokeLinejoin="round" />
        </svg>
      )
    case 'insert-text':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 7V4h16v3M9 20h6M12 4v16" strokeLinecap="round" />
        </svg>
      )
    case 'insert-heading':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M6 4v16M14 4v16M6 12h8" strokeLinecap="round" />
        </svg>
      )
    case 'insert-image':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10.5" r="1.5" />
          <path d="m21 17-5-5L8 20" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'insert-button':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="4" y="8" width="16" height="8" rx="2" />
        </svg>
      )
    case 'insert-section':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      )
    default:
      return null
  }
}

export function CanvasToolRail({ engagedTool, onToolChange, disabled }: CanvasToolRailProps) {
  const { t } = useApp() as { t: (key: string) => string }

  return (
    <div className="editor-canvas-tool-rail" role="toolbar" aria-label={t('ed.tool.railLabel')}>
      <span className="editor-canvas-tool-rail__sep editor-canvas-tool-rail__sep--top" aria-hidden />
      {TOOL_GROUPS.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 ? <span className="editor-canvas-tool-rail__sep" /> : null}
          {group.tools.map((tool) => (
            <button
              key={tool}
              type="button"
              className={`editor-canvas-tool-rail__btn${engagedTool === tool ? ' is-active' : ''}`}
              onClick={() => onToolChange(tool)}
              disabled={disabled}
              title={t(`ed.tool.${tool}`)}
              aria-label={t(`ed.tool.${tool}`)}
              aria-pressed={engagedTool === tool}
            >
              <ToolIcon tool={tool} />
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>
  )
}

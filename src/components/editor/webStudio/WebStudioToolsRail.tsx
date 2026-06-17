'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { WsIcon } from '@/components/editor/webStudio/WebStudioIcons'
import {
  WebStudioToolFlyout,
  type WebStudioFlyoutItem,
} from '@/components/editor/webStudio/WebStudioToolFlyout'
import {
  WEB_STUDIO_TOOL_SHORTCUTS,
  canvasToolFromShortcutKey,
} from '@/components/editor/webStudio/webStudioCanvasShortcuts'
import { formatShortcut } from '@/lib/keyboard/formatShortcut'
import { isEditableTarget } from '@/lib/keyboard/isEditableTarget'

export type WebStudioCanvasTool =
  | 'select'
  | 'rect'
  | 'edit'
  | 'connect'
  | 'properties'
  | 'pan'
  | 'image'
  | 'palette'

type ToolDef = {
  id: WebStudioCanvasTool
  Icon: React.ComponentType<{ size?: number }>
  labelKey: string
  soon?: boolean
  opensPanel?: boolean
  disabledOnImagePage?: boolean
  flyout?: WebStudioFlyoutItem[]
  /** Si está definido, el botón imagen abre el selector de archivo en lugar de un flyout. */
  uploadsToCanvas?: boolean
}

type WebStudioToolsRailProps = {
  activeTool: WebStudioCanvasTool
  sidePanelOpen?: boolean
  themePanelOpen?: boolean
  imagePageMode?: boolean
  onToolChange: (tool: WebStudioCanvasTool) => void
  onFlyoutSelect?: (toolId: WebStudioCanvasTool, flyoutId: string) => void
  onImageUploadRequest?: () => void
}

const PRIMARY_TOOLS: ToolDef[] = [
  { id: 'select', Icon: WsIcon.Cursor, labelKey: 'ed.design.toolSelect' },
  { id: 'pan', Icon: WsIcon.Hand, labelKey: 'ed.design.toolPan' },
  { id: 'edit', Icon: WsIcon.Pencil, labelKey: 'ed.design.toolEdit', disabledOnImagePage: true },
  {
    id: 'rect',
    Icon: WsIcon.RectDashed,
    labelKey: 'ed.webStudio.toolDraw',
  },
]

const CONNECT_TOOL: ToolDef = {
  id: 'connect',
  Icon: WsIcon.LinkPath,
  labelKey: 'ed.design.toolConnect',
  disabledOnImagePage: true,
}

const PALETTE_TOOL: ToolDef = {
  id: 'palette',
  Icon: WsIcon.Palette,
  labelKey: 'ed.webStudio.toolTheme',
  opensPanel: true,
  disabledOnImagePage: true,
}

const ALL_TOOLS: ToolDef[] = [...PRIMARY_TOOLS, CONNECT_TOOL, PALETTE_TOOL]

function toolShortcutLabel(toolId: WebStudioCanvasTool): string | null {
  const key = WEB_STUDIO_TOOL_SHORTCUTS[toolId]
  return key ? formatShortcut({ key }) : null
}

function WebStudioToolsRailInner({
  activeTool,
  sidePanelOpen = false,
  themePanelOpen = false,
  imagePageMode = false,
  onToolChange,
  onFlyoutSelect,
  onImageUploadRequest,
}: WebStudioToolsRailProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const railRef = useRef<HTMLElement>(null)
  const [openFlyout, setOpenFlyout] = useState<WebStudioCanvasTool | null>(null)

  useEffect(() => {
    if (sidePanelOpen) setOpenFlyout(null)
  }, [sidePanelOpen])

  useEffect(() => {
    setOpenFlyout(null)
  }, [activeTool])

  useEffect(() => {
    if (!openFlyout) return
    function onDoc(e: MouseEvent) {
      if (!railRef.current?.contains(e.target as Node)) setOpenFlyout(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [openFlyout])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditableTarget(e.target)) return

      if (e.key === 'Escape') {
        if (openFlyout) {
          e.preventDefault()
          setOpenFlyout(null)
        }
        return
      }

      const tool = canvasToolFromShortcutKey(e.key)
      if (!tool) return

      const def = ALL_TOOLS.find((d) => d.id === tool)
      if (!def) return
      if (imagePageMode && def.disabledOnImagePage) return

      e.preventDefault()
      setOpenFlyout(null)
      if (def.soon) return
      if (tool === 'image' && def.uploadsToCanvas) {
        onImageUploadRequest?.()
        return
      }
      onToolChange(tool)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [imagePageMode, onToolChange, openFlyout])

  function handleToolClick(tool: ToolDef) {
    if (imagePageMode && tool.disabledOnImagePage) return
    if (tool.id === 'image' && tool.uploadsToCanvas) {
      setOpenFlyout(null)
      onImageUploadRequest?.()
      return
    }
    if (tool.flyout?.length) {
      if (activeTool === tool.id) {
        setOpenFlyout((prev) => (prev === tool.id ? null : tool.id))
      } else {
        setOpenFlyout(null)
        onToolChange(tool.id)
      }
      return
    }
    setOpenFlyout(null)
    if (tool.soon) return
    onToolChange(tool.id)
  }

  function renderTool(tool: ToolDef) {
    const disabled = Boolean(imagePageMode && tool.disabledOnImagePage)
    const isActive =
      !disabled &&
      (activeTool === tool.id ||
        (tool.id === 'palette' && themePanelOpen) ||
        (tool.id === 'properties' && sidePanelOpen))
    const hasFlyout = Boolean(tool.flyout?.length)
    const shortcut = toolShortcutLabel(tool.id)

    return (
      <div key={tool.id} className="web-studio-tools-rail__slot">
        <button
          type="button"
          className={`web-studio-tools-rail__btn${isActive ? ' is-active' : ''}${hasFlyout ? ' has-flyout' : ''}${disabled ? ' is-disabled' : ''}`}
          aria-pressed={isActive}
          aria-expanded={hasFlyout ? openFlyout === tool.id : undefined}
          aria-haspopup={hasFlyout ? 'menu' : undefined}
          aria-disabled={disabled || undefined}
          aria-keyshortcuts={shortcut ?? undefined}
          aria-label={t(tool.labelKey)}
          title={disabled ? t('ed.design.toolDisabledOnImage') : undefined}
          disabled={disabled}
          onClick={() => handleToolClick(tool)}
        >
          <tool.Icon size={18} />
          {!disabled ? (
            <span className="web-studio-tools-rail__hint" role="tooltip">
              <span className="web-studio-tools-rail__hint-label">{t(tool.labelKey)}</span>
              {shortcut ? (
                <kbd className="web-studio-tools-rail__hint-key">{shortcut}</kbd>
              ) : null}
            </span>
          ) : null}
        </button>
        {hasFlyout && openFlyout === tool.id ? (
          <WebStudioToolFlyout
            items={tool.flyout!}
            onSelect={(flyoutId) => {
              setOpenFlyout(null)
              onFlyoutSelect?.(tool.id, flyoutId)
            }}
          />
        ) : null}
      </div>
    )
  }

  return (
    <nav
      ref={railRef}
      className={`web-studio-tools-rail${sidePanelOpen || themePanelOpen ? ' web-studio-tools-rail--panel-open' : ''}`}
      aria-label={t('ed.design.canvasToolbar')}
    >
      {PRIMARY_TOOLS.map(renderTool)}
      <span className="web-studio-tools-rail__divider" aria-hidden />
      {renderTool(CONNECT_TOOL)}
      <span className="web-studio-tools-rail__divider" aria-hidden />
      {renderTool(PALETTE_TOOL)}
    </nav>
  )
}

export const WebStudioToolsRail = React.memo(WebStudioToolsRailInner)

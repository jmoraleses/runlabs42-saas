'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { formatShortcut } from '@/lib/keyboard/formatShortcut'
import { WsIcon } from '@/components/editor/webStudio/WebStudioIcons'

export type DesignCanvasContextMenuState = {
  x: number
  y: number
  target: 'canvas' | 'frame'
  pageId?: string
  pageName?: string
} | null

export type DesignCanvasContextMenuVariant = 'compact' | 'select'

export type DesignCanvasContextMenuAction =
  | 'undo'
  | 'redo'
  | 'copy'
  | 'copyAsHtml'
  | 'copyAsPng'
  | 'copyAsDuplicate'
  | 'paste'
  | 'duplicate'
  | 'renamePage'
  | 'focus'
  | 'delete'
  | 'generate'
  | 'variations'
  | 'regenerate'
  | 'edit'
  | 'designMd'
  | 'previewTab'
  | 'showQrCode'
  | 'showConnections'
  | 'viewDetails'
  | 'viewCode'
  | 'export'
  | 'download'
  | 'reload'
  | 'format'
  | 'upload'
  | 'figmaExport'

type MenuItemDef = {
  id: DesignCanvasContextMenuAction
  labelKey: string
  shortcut?: string
  suffix?: string
  disabled?: boolean
  submenu?: boolean
  children?: MenuItemDef[]
}

type MenuBlock =
  | { type: 'heading'; labelKey: string }
  | { type: 'sep' }
  | { type: 'item'; def: MenuItemDef }

type DesignCanvasContextMenuProps = {
  menu: DesignCanvasContextMenuState
  variant: DesignCanvasContextMenuVariant
  canUndo?: boolean
  canRedo?: boolean
  hasActivePage?: boolean
  canDeletePage?: boolean
  hasSelection?: boolean
  busy?: boolean
  onClose: () => void
  onAction: (action: DesignCanvasContextMenuAction) => void
}

function buildSelectMenuBlocks(props: {
  target: 'canvas' | 'frame'
  hasActivePage: boolean
  hasSelection: boolean
  busy: boolean
  onFrame: boolean
}): MenuBlock[] {
  const { hasActivePage, hasSelection, busy, onFrame } = props

  const item = (
    id: DesignCanvasContextMenuAction,
    labelKey: string,
    opts?: Partial<MenuItemDef>,
  ): MenuBlock => ({ type: 'item', def: { id, labelKey, ...opts } })

  return [
    item('copy', 'ed.design.canvasMenu.copy', {
      shortcut: formatShortcut({ mod: true, key: 'C' }),
      disabled: !hasSelection && !hasActivePage,
    }),
    item('copyAsHtml', 'ed.design.canvasMenu.copyAs', {
      submenu: true,
      disabled: !hasSelection && !hasActivePage,
      children: [
        {
          id: 'copyAsHtml',
          labelKey: 'ed.design.canvasMenu.copyAsHtml',
          disabled: !hasSelection && !hasActivePage,
        },
        {
          id: 'copyAsPng',
          labelKey: 'ed.design.canvasMenu.copyAsPng',
          disabled: !onFrame || !hasActivePage,
        },
        {
          id: 'copyAsDuplicate',
          labelKey: 'ed.design.canvasMenu.duplicate',
          disabled: !onFrame || !hasActivePage || busy,
        },
      ],
    }),
    item('focus', 'ed.design.canvasMenu.focus', {
      shortcut: 'F',
      disabled: !hasActivePage,
    }),
    item('renamePage', 'ed.design.canvasMenu.renamePage', {
      disabled: !hasActivePage || busy,
    }),
    item('delete', 'ed.design.canvasMenu.delete', {
      disabled: !onFrame || !hasActivePage,
    }),
    { type: 'sep' },
    item('download', 'ed.design.canvasMenu.download', {
      shortcut: formatShortcut({ shift: true, key: 'D' }),
    }),
    item('reload', 'ed.design.canvasMenu.reload', {
      shortcut: formatShortcut({ mod: true, key: 'R' }),
    }),
  ]
}

const COMPACT_BLOCKS: MenuBlock[] = [
  {
    type: 'item',
    def: {
      id: 'undo',
      labelKey: 'ed.design.canvasMenu.undo',
      shortcut: formatShortcut({ mod: true, key: 'Z' }),
    },
  },
  {
    type: 'item',
    def: {
      id: 'redo',
      labelKey: 'ed.design.canvasMenu.redo',
      shortcut: formatShortcut({ mod: true, shift: true, key: 'Z' }),
    },
  },
  { type: 'sep' },
  {
    type: 'item',
    def: {
      id: 'paste',
      labelKey: 'ed.design.canvasMenu.paste',
      shortcut: formatShortcut({ mod: true, key: 'V' }),
    },
  },
  {
    type: 'item',
    def: {
      id: 'format',
      labelKey: 'ed.design.canvasMenu.format',
      shortcut: formatShortcut({ mod: true, shift: true, key: 'F' }),
    },
  },
  {
    type: 'item',
    def: { id: 'upload', labelKey: 'ed.design.canvasMenu.upload' },
  },
]

function MenuItemRow({
  def,
  disabled,
  label,
  onPick,
  t,
}: {
  def: MenuItemDef
  disabled: boolean
  label: string
  onPick: (id: DesignCanvasContextMenuAction) => void
  t: (key: string) => string
}) {
  const [subOpen, setSubOpen] = useState(false)

  if (!def.submenu || !def.children?.length) {
    return (
      <button
        type="button"
        role="menuitem"
        className="design-canvas-context-menu__item"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          onPick(def.id)
        }}
      >
        <span className="design-canvas-context-menu__label">{label}</span>
        {def.suffix ? (
          <span className="design-canvas-context-menu__suffix" aria-hidden>
            {def.suffix}
          </span>
        ) : def.shortcut ? (
          <span className="design-canvas-context-menu__shortcut" aria-hidden>
            {def.shortcut}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div
      className="design-canvas-context-menu__submenu-wrap"
      onMouseEnter={() => setSubOpen(true)}
      onMouseLeave={() => setSubOpen(false)}
    >
      <button
        type="button"
        role="menuitem"
        className="design-canvas-context-menu__item design-canvas-context-menu__item--submenu"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={subOpen}
      >
        <span className="design-canvas-context-menu__label">{label}</span>
        <WsIcon.ChevronRight size={14} className="design-canvas-context-menu__chevron" />
      </button>
      {subOpen ? (
        <div className="design-canvas-context-menu design-canvas-context-menu--flyout" role="menu">
          {def.children.map((child) => {
            const childDisabled = Boolean(child.disabled)
            return (
              <button
                key={child.id}
                type="button"
                role="menuitem"
                className="design-canvas-context-menu__item"
                disabled={childDisabled}
                onClick={() => {
                  if (childDisabled) return
                  onPick(child.id)
                }}
              >
                <span className="design-canvas-context-menu__label">{t(child.labelKey)}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function DesignCanvasContextMenu({
  menu,
  variant,
  canUndo = false,
  canRedo = false,
  hasActivePage = false,
  canDeletePage = false,
  hasSelection = false,
  busy = false,
  onClose,
  onAction,
}: DesignCanvasContextMenuProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const ref = useRef<HTMLDivElement>(null)

  const blocks = useMemo(() => {
    if (variant === 'compact') return COMPACT_BLOCKS
    if (!menu) return []
    return buildSelectMenuBlocks({
      target: menu.target,
      hasActivePage,
      hasSelection,
      busy,
      onFrame: menu.target === 'frame',
    })
  }, [variant, menu, hasActivePage, hasSelection, busy])

  useEffect(() => {
    if (!menu) return
    function onDoc(e: PointerEvent) {
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDoc, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu, onClose])

  if (!menu) return null

  function pick(action: DesignCanvasContextMenuAction) {
    onAction(action)
    onClose()
  }

  return (
    <div
      ref={ref}
      className={`design-canvas-context-menu design-canvas-context-menu--${variant}`}
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      aria-label={t('ed.design.canvasMenu.label')}
    >
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <p key={`h-${i}`} className="design-canvas-context-menu__heading">
              {t(block.labelKey)}
            </p>
          )
        }
        if (block.type === 'sep') {
          return <div key={`sep-${i}`} className="design-canvas-context-menu__sep" role="separator" />
        }
        const { def } = block
        const disabled =
          def.disabled ||
          (def.id === 'undo' && !canUndo) ||
          (def.id === 'redo' && !canRedo) ||
          (def.id === 'delete' && !canDeletePage)
        const label = def.submenu ? t(def.labelKey) : t(def.labelKey)

        if (def.submenu && def.children?.length) {
          return (
            <MenuItemRow
              key={`submenu-${i}`}
              def={def}
              disabled={disabled}
              label={label}
              onPick={pick}
              t={t}
            />
          )
        }

        return (
          <MenuItemRow
            key={def.id}
            def={def}
            disabled={disabled}
            label={label}
            onPick={pick}
            t={t}
          />
        )
      })}
    </div>
  )
}

/** Clic en el fondo del lienzo (no en controles flotantes). */
export function isDesignCanvasBackgroundTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (!target.closest('.design-canvas-area')) return false
  if (target.closest('.design-page-frame, .stitch-prototype-frame, .stitch-ds-frame')) {
    return false
  }
  if (
    target.closest(
      'button, a, input, textarea, select, [role="menu"], .web-studio-tools-rail, .web-studio-right-chrome, .editor-selection-box, .web-studio-zoom-control',
    )
  ) {
    return false
  }
  return true
}

export function findDesignFrameContextFromTarget(
  target: EventTarget | null,
): { pageId: string; pageName: string } | null {
  if (!(target instanceof Element)) return null
  const frame = target.closest(
    '.design-page-frame, .stitch-prototype-frame, .stitch-ds-frame',
  ) as HTMLElement | null
  if (!frame) return null
  const pageId = frame.dataset.pageId
  if (!pageId) return null
  const name =
    frame.querySelector('.design-page-frame__label, .stitch-prototype-frame__label')
      ?.textContent?.trim() || pageId
  return { pageId, pageName: name }
}

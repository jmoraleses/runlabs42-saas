'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CODE_TEMPLATES, CODE_TEMPLATE_META, type CodeTemplate } from '@/lib/codeTemplates'
import { Icon, useApp } from '@/components/app/shell'

type CreateCodeMenuProps = {
  codeTemplates: CodeTemplate[]
  onToggleCodeTemplate: (id: CodeTemplate) => void
  onConfirm: () => void
  disabled?: boolean
  canConvert?: boolean
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateCodeMenu({
  codeTemplates,
  onToggleCodeTemplate,
  onConfirm,
  disabled = false,
  canConvert = true,
  className = '',
  open: openControlled,
  onOpenChange,
}: CreateCodeMenuProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [openInternal, setOpenInternal] = useState(false)
  const open = openControlled ?? openInternal
  const setOpen = onOpenChange ?? setOpenInternal
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  )
  const menuId = useId()

  const triggerDisabled = disabled || !canConvert

  useEffect(() => {
    if (!open) return
    const updatePos = () => {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const width = Math.min(300, Math.max(rect.width, 268))
      let left = rect.right - width
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12))
      setPanelPos({
        top: rect.bottom + 8,
        left,
        width,
      })
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleTriggerClick() {
    if (triggerDisabled) return
    setOpen(!open)
  }

  function handleConfirm() {
    setOpen(false)
    onConfirm()
  }

  const panel =
    open && panelPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            id={menuId}
            className="create-code-menu__panel"
            role="dialog"
            aria-label={t('ed.design.codeTemplate.label')}
            style={{
              position: 'fixed',
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              zIndex: 10100,
            }}
          >
            <p className="create-code-menu__hint">{t('ed.design.codeTemplate.hint')}</p>
            <ul className="create-code-menu__list" role="listbox" aria-label={t('ed.design.codeTemplate.label')}>
              {CODE_TEMPLATES.map((id) => {
                const meta = CODE_TEMPLATE_META[id]
                const label = t(meta.labelKey)
                const selected = codeTemplates.includes(id)
                return (
                  <li key={id} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`create-code-menu__option${selected ? ' is-active' : ''}`}
                      onClick={() => onToggleCodeTemplate(id)}
                    >
                      <span className="create-code-menu__glyph" aria-hidden>
                        {meta.glyph}
                      </span>
                      <span className="create-code-menu__label">{label}</span>
                      {selected ? (
                        <span className="create-code-menu__check" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="create-code-menu__footer">
              <button
                type="button"
                className="btn btn-sm btn-accent create-code-menu__confirm"
                onClick={handleConfirm}
              >
                {t('ed.design.convert')}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div
      ref={anchorRef}
      className={`create-code-menu${className ? ` ${className}` : ''}`.trim()}
    >
      <button
        type="button"
        className="btn btn-sm editor-workspace-action-btn editor-workspace-action-btn--convert"
        disabled={triggerDisabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={handleTriggerClick}
        title={t('ed.design.phase.code')}
      >
        <Icon.Code />
        <span className="editor-workspace-action-btn__label">{t('ed.design.phase.code')}</span>
      </button>
      {panel}
    </div>
  )
}

'use client'

import React, { useRef } from 'react'
import { Icon, useApp } from '@/components/app/shell'
import { WsIcon } from '@/components/editor/webStudio/WebStudioIcons'
import { useCloseOnClickOutside } from '@/hooks/useCloseOnClickOutside'
import type { ImageModelOption } from '@/hooks/useImageModel'

type ChatImageModelMenuProps = {
  value: string
  options: ImageModelOption[]
  generateImages: boolean
  onGenerateImagesChange: (enabled: boolean) => void
  onChange: (modelId: string) => void
  disabled?: boolean
  generationDisabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Ancla del menú (p. ej. barra Web Studio). */
  anchorRef?: React.RefObject<HTMLElement | null>
}

export function ChatImageModelMenu({
  value,
  options,
  generateImages,
  onGenerateImagesChange,
  onChange,
  disabled,
  generationDisabled = false,
  open: openControlled,
  onOpenChange,
  anchorRef: anchorRefProp,
}: ChatImageModelMenuProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const rootRef = useRef<HTMLDivElement>(null)
  const isControlled = openControlled !== undefined
  const open = isControlled ? openControlled : false

  const anchorRef = anchorRefProp ?? rootRef
  useCloseOnClickOutside(anchorRef, open, () => onOpenChange?.(false))

  function setMenuOpen(next: boolean) {
    onOpenChange?.(next)
  }

  function pick(modelId: string) {
    if (modelId === value && generateImages) {
      onGenerateImagesChange(false)
      setMenuOpen(false)
      return
    }
    onChange(modelId)
    onGenerateImagesChange(true)
    setMenuOpen(false)
  }

  const selectedLabel =
    options.find((o) => o.id === value)?.label ?? value

  const triggerDisabled = Boolean(disabled || generationDisabled)

  return (
    <div className="composer-menu-anchor composer-menu-anchor--image-model" ref={rootRef}>
      <button
        type="button"
        className={`web-studio-prompt__tool${generateImages ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        aria-label={
          generateImages
            ? t('chat.imageModelMenu.openWithModel').replace('{model}', selectedLabel)
            : t('chat.imageModelMenu.open')
        }
        aria-pressed={generateImages}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={triggerDisabled && !open}
        onClick={() => {
          if (triggerDisabled) return
          setMenuOpen(!open)
        }}
      >
        <WsIcon.Image size={18} />
      </button>

      {open && (
        <div className="composer-menu composer-menu--image-model" role="menu">
          {generationDisabled ? (
            <p className="composer-menu-note composer-menu-note--warning">
              {t('chat.imageModelMenu.disabledAdmin')}
            </p>
          ) : null}

          {options.length > 0 ? (
            <>
              <p className="composer-menu-heading">{t('chat.imageModelMenu.modelHeading')}</p>
              {options.map((opt) => {
                const selected = value === opt.id
                const active = selected && generateImages
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    disabled={generationDisabled}
                    className={`composer-menu-item composer-menu-item--model${selected ? ' is-selected' : ''}`}
                    onClick={() => pick(opt.id)}
                  >
                    <span className="composer-menu-item-body">
                      <span className="composer-model-head">
                        <span className="composer-model-head__name">{opt.label}</span>
                      </span>
                      <span className="composer-menu-item-desc composer-menu-item-desc--mono">
                        {opt.id}
                      </span>
                      {opt.perImage ? (
                        <span className="composer-model-meta composer-model-meta--note">
                          {opt.perImage}
                        </span>
                      ) : null}
                    </span>
                    {active ? (
                      <span className="composer-menu-item-check" aria-hidden>
                        <Icon.Check />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

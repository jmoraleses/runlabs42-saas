'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

const FONT_SIZES = ['12px', '13px', '14px', '16px', '18px', '24px', '32px', '38px']

type ElementStyleMenuProps = {
  position: { top: number; left: number }
  currentSize?: string
  onPickSize: (size: string) => void
  onClose: () => void
}

export function ElementStyleMenu({ position, currentSize, onPickSize, onClose }: ElementStyleMenuProps) {
  const { t } = useApp() as { t: (key: string) => string }

  return (
    <>
      <button type="button" className="editor-style-menu-backdrop" aria-label={t('ed.cancel')} onClick={onClose} />
      <div
        className="editor-style-menu"
        style={{ top: position.top, left: position.left }}
        role="menu"
      >
        <span className="editor-style-menu-label">{t('ed.fontSize')}</span>
        <div className="editor-style-menu-grid">
          {FONT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              role="menuitem"
              className={`editor-style-menu-item${currentSize === size ? ' is-active' : ''}`}
              onClick={() => onPickSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

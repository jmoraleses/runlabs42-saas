'use client'

import React, { useRef, useEffect } from 'react'
import { useApp } from '@/components/app/shell'

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'] as const

type VisualFontSizeMenuProps = {
  open: boolean
  current?: string
  onSelect: (size: string) => void
  onClose: () => void
}

export function VisualFontSizeMenu({ open, current, onSelect, onClose }: VisualFontSizeMenuProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div ref={ref} className="editor-font-size-menu" role="menu" aria-label={t('ed.fontSize')}>
      {FONT_SIZES.map((size) => (
        <button
          key={size}
          type="button"
          role="menuitem"
          className={`editor-font-size-menu__btn${current === size ? ' is-active' : ''}`}
          onClick={() => {
            onSelect(size)
            onClose()
          }}
        >
          {size}
        </button>
      ))}
    </div>
  )
}

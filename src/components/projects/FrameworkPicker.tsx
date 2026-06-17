'use client'

import React from 'react'
import { FRAMEWORKS, FRAMEWORK_GROUPS, useApp } from '@/components/app/shell'

type FrameworkPickerProps = {
  value: string
  onChange: (id: string) => void
  className?: string
}

export function FrameworkPicker({ value, onChange, className = '' }: FrameworkPickerProps) {
  const { t } = useApp() as { t: (key: string) => string }

  const groups = ['web', 'canvas'] as const

  return (
    <div className={`framework-picker ${className}`.trim()}>
      {groups.map((group) => {
        const items = FRAMEWORKS.filter((f) => f.group === group)
        if (!items.length) return null
        const meta = FRAMEWORK_GROUPS[group]
        return (
          <div key={group} className="framework-picker__group">
            <span className="framework-picker__label">{t(meta.labelKey)}</span>
            <div className="framework-picker__grid" role="listbox" aria-label={t(meta.labelKey)}>
              {items.map((fw) => (
                <button
                  key={fw.id}
                  type="button"
                  role="option"
                  aria-selected={value === fw.id}
                  className={`framework-picker__item${value === fw.id ? ' is-active' : ''}`}
                  onClick={() => onChange(fw.id)}
                  style={{ '--fw-color': fw.color } as React.CSSProperties}
                >
                  <span className="framework-picker__glyph" aria-hidden>
                    {fw.glyph}
                  </span>
                  <span className="framework-picker__name">{fw.name}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

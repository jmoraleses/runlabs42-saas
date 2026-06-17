'use client'

import React from 'react'
import { CODE_TEMPLATES, CODE_TEMPLATE_META, type CodeTemplate } from '@/lib/codeTemplates'
import { useApp } from '@/components/app/shell'

type CodeTemplatePickerProps = {
  value: CodeTemplate
  onChange: (id: CodeTemplate) => void
  disabled?: boolean
  className?: string
}

export function CodeTemplatePicker({
  value,
  onChange,
  disabled = false,
  className = '',
}: CodeTemplatePickerProps) {
  const { t } = useApp() as { t: (key: string) => string }

  return (
    <div
      className={`code-template-picker framework-picker ${className}`.trim()}
      role="group"
      aria-label={t('ed.design.codeTemplate.label')}
    >
      <span className="framework-picker__label">{t('ed.design.codeTemplate.label')}</span>
      <div className="framework-picker__grid code-template-picker__grid" role="listbox">
        {CODE_TEMPLATES.map((id) => {
          const meta = CODE_TEMPLATE_META[id]
          const label = t(meta.labelKey)
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={value === id}
              disabled={disabled}
              className={`framework-picker__item code-template-picker__item${value === id ? ' is-active' : ''}`}
              title={t('ed.design.codeTemplate.hint')}
              onClick={() => onChange(id)}
            >
              <span className="framework-picker__glyph code-template-picker__glyph" aria-hidden>
                {meta.glyph}
              </span>
              <span className="framework-picker__name">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

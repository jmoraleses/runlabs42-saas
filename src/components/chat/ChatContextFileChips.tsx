'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

type ChatContextFileChipsProps = {
  paths: string[]
  onRemove?: (path: string) => void
  readOnly?: boolean
}

export function ChatContextFileChips({ paths, onRemove, readOnly }: ChatContextFileChipsProps) {
  const { t } = useApp() as { t: (key: string) => string }
  if (!paths.length) return null

  return (
    <div className="chat-context-chips" aria-label={t('chat.context.attached')}>
      {paths.map((path) => (
        <span key={path} className="chat-context-chip mono" title={path}>
          @{path.split('/').pop() ?? path}
          {!readOnly && onRemove ? (
            <button
              type="button"
              className="chat-context-chip__remove"
              onClick={() => onRemove(path)}
              aria-label={t('chat.context.remove').replace('{file}', path)}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  )
}

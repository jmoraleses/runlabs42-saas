'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

type ChatFileMentionMenuProps = {
  open: boolean
  options: { path: string }[]
  activeIndex: number
  onSelect: (path: string) => void
}

export function ChatFileMentionMenu({
  open,
  options,
  activeIndex,
  onSelect,
}: ChatFileMentionMenuProps) {
  const { t } = useApp() as { t: (key: string) => string }

  if (!open || !options.length) return null

  return (
    <div className="chat-file-mention-menu" role="listbox">
      <div className="chat-file-mention-menu__title">{t('chat.context.pickFile')}</div>
      <ul className="chat-file-mention-menu__list">
        {options.map((opt, i) => (
          <li key={opt.path}>
            <button
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              className={`chat-file-mention-menu__item${i === activeIndex ? ' is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(opt.path)
              }}
            >
              <span className="chat-file-mention-menu__path mono">{opt.path}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

'use client'

import React, { useMemo, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { ComposerToolButton } from '@/components/chat/ComposerToolButton'
import { useCloseOnClickOutside } from '@/hooks/useCloseOnClickOutside'
import {
  filterMentionableFiles,
  type WorkspaceFileOption,
} from '@/components/chat/useChatFileMentions'

const AtIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.8 7.7" />
  </svg>
)

type ChatFileContextButtonProps = {
  getFiles: () => WorkspaceFileOption[]
  contextPaths: string[]
  onAddPath: (path: string) => void
  disabled?: boolean
}

export function ChatFileContextButton({
  getFiles,
  contextPaths,
  onAddPath,
  disabled,
}: ChatFileContextButtonProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useCloseOnClickOutside(rootRef, open, () => setOpen(false))

  const options = useMemo(() => {
    return filterMentionableFiles(getFiles()).filter((f) => !contextPaths.includes(f.path))
  }, [getFiles, contextPaths, open])

  const label = t('chat.context.attachBtn')
  const hasContext = contextPaths.length > 0

  return (
    <div className="chat-file-context-btn-wrap" ref={rootRef}>
      <ComposerToolButton
        label={label}
        active={open || hasContext}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <AtIcon />
      </ComposerToolButton>
      {open ? (
        <div className="chat-file-context-picker" role="dialog" aria-label={label}>
          <p className="chat-file-context-picker__title">{t('chat.context.pickFile')}</p>
          {options.length ? (
            <ul className="chat-file-context-picker__list">
              {options.map((opt) => (
                <li key={opt.path}>
                  <button
                    type="button"
                    className="chat-file-context-picker__item"
                    onClick={() => {
                      onAddPath(opt.path)
                      setOpen(false)
                    }}
                  >
                    <span className="chat-file-context-picker__name mono">
                      {opt.path.split('/').pop() ?? opt.path}
                    </span>
                    <span className="chat-file-context-picker__path mono">{opt.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="chat-file-context-picker__empty">{t('chat.context.noFiles')}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

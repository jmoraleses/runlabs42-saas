'use client'

import React from 'react'
import { Icon, useApp } from '@/components/app/shell'
import type { ProjectChatSession } from '@/lib/chat/types'

type ChatSessionTabsProps = {
  sessions: ProjectChatSession[]
  activeId: string
  newChatLabel: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
  /** Integrado en la barra única del chat de Studio */
  variant?: 'default' | 'inline'
  className?: string
}

export function ChatSessionTabs({
  sessions,
  activeId,
  newChatLabel,
  onSelect,
  onClose,
  onNew,
  variant = 'default',
  className = '',
}: ChatSessionTabsProps) {
  const { t } = useApp() as { t: (k: string) => string }
  const rootClass =
    variant === 'inline'
      ? `editor-chat-session-tabs editor-chat-session-tabs--inline${className ? ` ${className}` : ''}`
      : `editor-chat-session-tabs${className ? ` ${className}` : ''}`

  return (
    <div className={rootClass} role="tablist" aria-label={t('ed.chatSessions')}>
      <div className="editor-chat-session-tabs__scroll no-scrollbar">
        {sessions.map((session) => {
          const label = session.title.trim() || newChatLabel
          const isActive = session.id === activeId
          return (
            <div
              key={session.id}
              className={`editor-chat-session-tab${isActive ? ' is-active' : ''}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className="editor-chat-session-tab__label"
                onClick={() => onSelect(session.id)}
                title={label}
              >
                <span className="editor-chat-session-tab__text">{label}</span>
              </button>
              <button
                type="button"
                className="editor-chat-session-tab__close"
                aria-label={t('ed.chatCloseTab')}
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(session.id)
                }}
              >
                <Icon.X />
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="editor-chat-session-tab editor-chat-session-tab--new"
        aria-label={t('ed.chatNew')}
        onClick={onNew}
      >
        <Icon.Plus />
      </button>
    </div>
  )
}

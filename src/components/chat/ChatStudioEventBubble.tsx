'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import type { ChatStudioEvent } from '@/lib/chat/studioEvents'

type ChatStudioEventBubbleProps = {
  event: ChatStudioEvent
}

function basename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

export function ChatStudioEventBubble({ event }: ChatStudioEventBubbleProps) {
  const { t } = useApp() as { t: (key: string) => string }

  if (event.kind === 'compile-error') {
    return (
      <div className="chat-studio-event chat-studio-event--error" role="status">
        <div className="chat-studio-event__head">
          <span className="chat-studio-event__icon" aria-hidden>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 5v4M8 11h.01" />
            </svg>
          </span>
          <span className="chat-studio-event__title">{t('chat.studio.compileError')}</span>
        </div>
        {event.file ? (
          <span className="chat-studio-event__file mono" title={event.file}>
            {basename(event.file)}
          </span>
        ) : null}
        <p className="chat-studio-event__detail">{event.summary}</p>
      </div>
    )
  }

  if (event.kind === 'compile-fixing') {
    return (
      <div className="chat-studio-event chat-studio-event--info" role="status">
        <div className="chat-studio-event__head">
          <span className="chat-studio-event__spinner" aria-hidden />
          <span className="chat-studio-event__title">
            {t('chat.studio.compileFixing').replace('{file}', basename(event.file))}
          </span>
        </div>
      </div>
    )
  }

  if (event.kind === 'compile-fixed') {
    return (
      <div className="chat-studio-event chat-studio-event--success" role="status">
        <div className="chat-studio-event__head">
          <span className="chat-studio-event__icon" aria-hidden>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5l3.5 3.5L13 5" />
            </svg>
          </span>
          <span className="chat-studio-event__title">{t('chat.studio.compileFixed')}</span>
        </div>
        {event.file ? (
          <span className="chat-studio-event__file mono" title={event.file}>
            {basename(event.file)}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="chat-studio-event chat-studio-event--error" role="status">
      <div className="chat-studio-event__head">
        <span className="chat-studio-event__icon" aria-hidden>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
          </svg>
        </span>
        <span className="chat-studio-event__title">{t('chat.studio.compileFailed')}</span>
      </div>
    </div>
  )
}

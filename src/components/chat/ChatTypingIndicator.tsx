'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

/** Indicador de “escribiendo…” mientras el modelo responde. */
export function ChatTypingIndicator() {
  const { t } = useApp() as { t: (key: string) => string }
  return (
    <div className="editor-chat-typing" role="status" aria-live="polite" aria-label={t('chat.typing')}>
      <span className="editor-chat-typing__dot" />
      <span className="editor-chat-typing__dot" />
      <span className="editor-chat-typing__dot" />
    </div>
  )
}

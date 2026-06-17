'use client'

import React, { useMemo, useState } from 'react'
import { useApp } from '@/components/app/shell'

const MIN_COLLAPSE_CHARS = 220
const MIN_COLLAPSE_LINES = 4

type ChatUserMessageProps = {
  content: string
}

function needsCollapse(content: string): boolean {
  if (content.length > MIN_COLLAPSE_CHARS) return true
  return content.split('\n').length > MIN_COLLAPSE_LINES
}

export function ChatUserMessage({ content }: ChatUserMessageProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const collapsible = useMemo(() => needsCollapse(content), [content])
  const [expanded, setExpanded] = useState(false)

  if (!collapsible) {
    return <p className="chat-user-message__text">{content}</p>
  }

  return (
    <div className="chat-user-message">
      <p className={`chat-user-message__text${expanded ? '' : ' is-collapsed'}`}>{content}</p>
      <button
        type="button"
        className="chat-user-message__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? t('chat.userMessage.collapse') : t('chat.userMessage.expand')}
      </button>
    </div>
  )
}

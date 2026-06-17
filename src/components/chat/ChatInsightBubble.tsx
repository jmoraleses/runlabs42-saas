'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import type { ChatInsightPayload } from '@/lib/ai/chatInsight'
import { getTypologyMeta } from '@/lib/ai/chatInsight'

type ChatInsightBubbleProps = {
  insight: ChatInsightPayload
}

export function ChatInsightBubble({ insight }: ChatInsightBubbleProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const meta = getTypologyMeta(insight.typology)

  return (
    <div className="chat-insight" role="status" aria-live="polite">
      <div className="chat-insight__head">
        <span
          className="chat-insight__badge"
          style={
            {
              '--insight-color': meta.color,
            } as React.CSSProperties
          }
        >
          <span className="chat-insight__glyph" aria-hidden>
            {meta.glyph}
          </span>
          <span className="chat-insight__typology">{t(meta.labelKey)}</span>
        </span>
        {insight.suggestedFramework ? (
          <span className="chat-insight__framework mono" title={insight.suggestedFramework}>
            {insight.suggestedFramework}
          </span>
        ) : null}
      </div>
      <p className="chat-insight__summary">{insight.summary}</p>
      {insight.stackHint ? (
        <p className="chat-insight__stack">{insight.stackHint}</p>
      ) : null}
    </div>
  )
}

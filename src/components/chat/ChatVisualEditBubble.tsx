'use client'

import React from 'react'
import { Icon, useApp } from '@/components/app/shell'
import type { VisualEditMessageMeta } from '@/lib/visual-edit/visualEditMessage'

type ChatVisualEditBubbleProps = {
  meta: VisualEditMessageMeta
}

export function ChatVisualEditBubble({ meta }: ChatVisualEditBubbleProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const fileName = meta.sourceFile?.split('/').pop()

  return (
    <div className="chat-visual-edit">
      <div className="chat-visual-edit__head">
        <span className="chat-visual-edit__badge">
          {meta.insertKind ? <Icon.Spark /> : <Icon.Pencil />}
          {meta.insertKind ? t('ed.visualInsertChat.badge') : t('ed.visualEditChat.badge')}
        </span>
        <span className="chat-visual-edit__target mono">
          &lt;{meta.elementTag}&gt;
          {meta.elementId ? ` · ${meta.elementId}` : null}
        </span>
      </div>
      {fileName ? (
        <span className="chat-visual-edit__file mono" title={meta.sourceFile ?? undefined}>
          {fileName}
        </span>
      ) : null}
      <p className="chat-visual-edit__prompt">{meta.userPrompt}</p>
    </div>
  )
}

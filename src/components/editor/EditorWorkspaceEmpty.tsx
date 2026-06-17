'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

type EditorWorkspaceEmptyProps = {
  variant: 'preview' | 'code'
}

export function EditorWorkspaceEmpty({ variant }: EditorWorkspaceEmptyProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const key = variant === 'preview' ? 'ed.emptyPreview' : 'ed.emptyCode'

  const message = t(key)
  const showEllipsis = variant === 'preview'

  return (
    <div className="editor-workspace-empty" aria-live="polite">
      <p aria-label={showEllipsis ? `${message}…` : undefined}>
        {message}
        {showEllipsis ? <span className="editor-workspace-empty__dots" aria-hidden /> : null}
      </p>
    </div>
  )
}

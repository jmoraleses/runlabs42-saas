'use client'

import React from 'react'

type EditorWorkspaceNoticeProps = {
  type: 'success' | 'error' | 'info'
  message: string
}

export function EditorWorkspaceNotice({ type, message }: EditorWorkspaceNoticeProps) {
  return (
    <div
      className={`editor-workspace-notice editor-workspace-notice--${type}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}

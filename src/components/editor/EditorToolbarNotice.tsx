'use client'

import React from 'react'

type EditorToolbarNoticeProps = {
  type: 'success' | 'error' | 'info'
  message: string
}

export function EditorToolbarNotice({ type, message }: EditorToolbarNoticeProps) {
  return (
    <div
      className={`editor-toolbar-notice editor-toolbar-notice--${type}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}

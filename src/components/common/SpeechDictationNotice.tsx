'use client'

import React from 'react'

type SpeechDictationNoticeProps = {
  message: string
  /** `preview` = centrado en el área de vista previa del Studio. */
  variant?: 'preview' | 'composer'
}

/** Aviso de dictado centrado (estilo burbuja de chat, color aviso). */
export function SpeechDictationNotice({ message, variant = 'composer' }: SpeechDictationNoticeProps) {
  return (
    <div
      className={`speech-dictation-notice speech-dictation-notice--${variant}`}
      role="alert"
      aria-live="polite"
    >
      <div className="editor-chat-msg editor-chat-msg--assistant">
        <div className="chat-bubble speech-dictation-notice__bubble">
          <p className="speech-dictation-notice__text">{message}</p>
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { useCallback, useEffect } from 'react'
import { useApp } from '@/components/app/shell'
import { useSpeechDictation } from '@/hooks/useSpeechDictation'

type SpeechDictationButtonProps = {
  getText: () => string
  setText: (text: string) => void
  disabled?: boolean
  className?: string
  /** Aviso centrado en el panel (no inline bajo el composer). */
  onNotice?: (message: string | null) => void
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
    </svg>
  )
}

export function SpeechDictationButton({
  getText,
  setText,
  disabled,
  className = 'chat-composer-speech-btn',
  onNotice,
}: SpeechDictationButtonProps) {
  const { t, lang } = useApp() as { t: (k: string) => string; lang: string }

  const handleError = useCallback(
    (code: string) => {
      const key =
        code === 'unsupported'
          ? 'speech.dictation.unsupported'
          : code === 'not-allowed'
            ? 'speech.dictation.permission'
            : 'speech.dictation.error'
      const message = t(key)
      if (onNotice) onNotice(message)
      else window.alert(message)
    },
    [t, onNotice],
  )

  const { listening, supported, toggle } = useSpeechDictation({
    lang,
    getText,
    setText,
    onError: handleError,
  })

  useEffect(() => {
    if (listening) onNotice?.(null)
  }, [listening, onNotice])

  const label = listening
    ? t('speech.dictation.stop')
    : supported
      ? t('speech.dictation.start')
      : t('speech.dictation.unsupported')

  return (
    <button
      type="button"
      className={`${className}${listening ? ' is-listening' : ''}${!supported ? ' is-unsupported' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (!supported) {
          handleError('unsupported')
          return
        }
        void toggle()
      }}
      aria-label={label}
      title={label}
      aria-pressed={listening}
    >
      <MicIcon />
      {listening ? <span className="chat-composer-speech-btn__pulse" aria-hidden /> : null}
    </button>
  )
}

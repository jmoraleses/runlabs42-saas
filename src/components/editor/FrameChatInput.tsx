'use client'

import React, { useState } from 'react'
import { useApp } from '@/components/app/shell'

type FrameChatInputProps = {
  disabled?: boolean
  busy?: boolean
  placeholder?: string
  onSubmit: (prompt: string) => void | Promise<void>
}

export function FrameChatInput({
  disabled,
  busy,
  placeholder,
  onSubmit,
}: FrameChatInputProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [value, setValue] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = value.trim()
    if (!text || disabled || busy) return
    setValue('')
    await onSubmit(text)
  }

  return (
    <form className="design-frame-composer" onSubmit={(e) => void handleSubmit(e)}>
      <div className="design-frame-composer__field">
        <input
          className="design-frame-composer__input"
          type="text"
          value={value}
          disabled={disabled || busy}
          placeholder={placeholder ?? t('ed.design.frameChatPlaceholder')}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="submit"
          className="design-frame-composer__send"
          disabled={disabled || busy || !value.trim()}
          aria-label={t('ed.design.frameChatSend')}
        >
          {busy ? '…' : '↑'}
        </button>
      </div>
    </form>
  )
}

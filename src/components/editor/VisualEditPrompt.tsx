'use client'

import React, { useState } from 'react'
import type { ElementDescriptor } from '@/lib/visual-edit/protocol'

type VisualEditPromptProps = {
  selection: ElementDescriptor | null
  onSubmit: (prompt: string, selection: ElementDescriptor | null) => void
  disabled?: boolean
}

/** Barra flotante “¿Qué te gustaría cambiar?” (estilo Base44) — sin API de modelos. */
export function VisualEditPrompt({ selection, onSubmit, disabled }: VisualEditPromptProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = value.trim()
    if (!text) return
    onSubmit(text, selection)
    setValue('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        position: 'absolute',
        bottom: 76,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(420px, calc(100% - 32px))',
        display: 'flex',
        gap: 8,
        padding: '8px 10px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        boxShadow: 'var(--shadow-md)',
        zIndex: 20,
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={selection ? '¿Qué te gustaría cambiar?' : 'Selecciona un elemento…'}
        disabled={disabled || !selection}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          fontSize: 13,
          color: 'var(--text)',
          outline: 'none',
          padding: '6px 10px',
        }}
      />
      <button type="submit" className="btn btn-primary btn-sm" disabled={disabled || !selection || !value.trim()} style={{ borderRadius: 999 }}>
        →
      </button>
    </form>
  )
}

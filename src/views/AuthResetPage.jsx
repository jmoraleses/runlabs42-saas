'use client'

import React, { useState } from 'react'
import { requestPasswordResetAction, updatePasswordAction } from '@/lib/auth/actions'
import { MarketingShell } from '@/components/app/shell'

export function AuthResetPage({ mode = 'request' }) {
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setMessage(null)
    const fd = new FormData(e.currentTarget)
    const result =
      mode === 'confirm'
        ? await updatePasswordAction(fd)
        : await requestPasswordResetAction(fd)
    setPending(false)
    if (result?.error) setError(result.error)
    else if (result?.ok) setMessage('Revisa tu email para el enlace de recuperación.')
  }

  return (
    <MarketingShell>
      <div className="container" style={{ maxWidth: 420, padding: '80px 24px' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>
          {mode === 'confirm' ? 'Nueva contraseña' : 'Recuperar contraseña'}
        </h1>
        <p style={{ color: 'var(--text-mid)', marginBottom: 24, fontSize: 14 }}>
          {mode === 'confirm'
            ? 'Elige una contraseña segura para tu cuenta Runlabs42.'
            : 'Te enviaremos un enlace para restablecer la contraseña.'}
        </p>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'request' && (
            <input
              name="email"
              type="email"
              required
              placeholder="tu@email.com"
              className="input"
              style={{ width: '100%', padding: 12 }}
            />
          )}
          {mode === 'confirm' && (
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Nueva contraseña"
              className="input"
              style={{ width: '100%', padding: 12 }}
            />
          )}
          {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
          {message && <p style={{ color: 'var(--success)', fontSize: 13 }}>{message}</p>}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Enviando…' : mode === 'confirm' ? 'Guardar' : 'Enviar enlace'}
          </button>
        </form>
      </div>
    </MarketingShell>
  )
}

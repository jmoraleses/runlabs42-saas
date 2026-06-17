'use client'

import React, { useState } from 'react'
import { useApp } from '@/components/app/shell'
import { connectFigmaPopup, primeFigmaOAuthTab } from '@/lib/auth/connectFigma'
import { consumeFigmaImportStream } from '@/lib/ai/designGenerateStream'

type WebStudioFigmaImportDialogProps = {
  projectId: string
  projectName?: string
  framework?: string
  device?: string
  figmaConnected: boolean
  figmaOAuthConfigured?: boolean
  onClose: () => void
  onConnected?: () => void
  onImported: () => void | Promise<void>
  onBusyChange?: (busy: boolean) => void
  onLog?: (message: string, status?: 'pending' | 'done' | 'error') => void
}

export function WebStudioFigmaImportDialog({
  projectId,
  projectName = 'Proyecto',
  framework = 'react',
  device = 'desktop',
  figmaConnected,
  figmaOAuthConfigured = false,
  onClose,
  onConnected,
  onImported,
  onBusyChange,
  onLog,
}: WebStudioFigmaImportDialogProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [fileUrl, setFileUrl] = useState('')
  const [prompt, setPrompt] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(figmaConnected)

  // PAT flow (when OAuth is not configured)
  const [pat, setPat] = useState('')
  const [savingPat, setSavingPat] = useState(false)

  async function handleOAuthConnect() {
    setConnecting(true)
    setError(null)
    try {
      primeFigmaOAuthTab()
      await connectFigmaPopup()
      setConnected(true)
      onConnected?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('set.connectError'))
    } finally {
      setConnecting(false)
    }
  }

  async function handlePatConnect() {
    if (!pat.trim()) {
      setError(t('ed.design.figmaPatRequired'))
      return
    }
    setSavingPat(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/figma/pat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pat: pat.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? t('set.connectError'))
      }
      setConnected(true)
      onConnected?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('set.connectError'))
    } finally {
      setSavingPat(false)
    }
  }

  async function handleImport() {
    if (!fileUrl.trim()) {
      setError(t('ed.design.figmaUrlRequired'))
      return
    }
    setImporting(true)
    onBusyChange?.(true)
    onLog?.(t('ed.design.figmaImporting'), 'pending')
    setError(null)
    try {
      await consumeFigmaImportStream(
        projectId,
        {
          fileUrl: fileUrl.trim(),
          prompt: prompt.trim() || undefined,
          projectName,
          framework,
          device,
        },
        {
          onToken: () => {},
          onFiles: () => {},
          onError: (msg) => {
            throw new Error(msg)
          },
        },
      )
      onLog?.(t('ed.design.figmaImported'), 'done')
      await onImported()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('ed.design.error')
      setError(msg)
      onLog?.(msg, 'error')
    } finally {
      setImporting(false)
      onBusyChange?.(false)
    }
  }

  return (
    <div className="web-studio-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="web-studio-modal"
        role="dialog"
        aria-labelledby="figma-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="figma-import-title" className="web-studio-modal__title">
          {t('chat.attachMenu.figma')}
        </h3>

        {!connected ? (
          <>
            <p className="web-studio-modal__desc">{t('ed.design.figmaConnectHint')}</p>

            {figmaOAuthConfigured ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={connecting}
                onClick={() => void handleOAuthConnect()}
              >
                {connecting ? t('set.connecting') : t('ed.design.figmaConnect')}
              </button>
            ) : null}

            <div className="web-studio-modal__pat-section">
              <p className="web-studio-modal__pat-label">{t('ed.design.figmaPatLabel')}</p>
              <input
                type="password"
                className="web-studio-modal__input"
                placeholder={t('ed.design.figmaPatPlaceholder')}
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                disabled={savingPat}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handlePatConnect()
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingPat || !pat.trim()}
                onClick={() => void handlePatConnect()}
              >
                {savingPat ? t('set.connecting') : t('ed.design.figmaPatConnect')}
              </button>
              <p className="web-studio-modal__pat-hint">
                <a
                  href="https://www.figma.com/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="web-studio-modal__link"
                >
                  {t('ed.design.figmaPatHintLink')}
                </a>
                {' — '}{t('ed.design.figmaPatHint')}
              </p>
            </div>
          </>
        ) : (
          <>
            <label className="web-studio-modal__label">
              {t('ed.design.figmaFileUrl')}
              <input
                type="url"
                className="web-studio-modal__input"
                placeholder="https://www.figma.com/design/..."
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                disabled={importing}
                autoFocus
              />
            </label>
            <label className="web-studio-modal__label">
              {t('ed.design.figmaExtraPrompt')}
              <textarea
                className="web-studio-modal__textarea"
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={importing}
                placeholder={t('ed.design.figmaExtraPromptPlaceholder')}
              />
            </label>
            {importing ? (
              <p className="web-studio-modal__progress">{t('ed.design.figmaImporting')}</p>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={importing || !fileUrl.trim()}
                onClick={() => void handleImport()}
              >
                {t('ed.design.figmaImportBtn')}
              </button>
            )}
            <button
              type="button"
              className="web-studio-modal__reconnect"
              onClick={() => setConnected(false)}
            >
              {t('ed.design.figmaReconnect')}
            </button>
          </>
        )}

        {error ? <p className="web-studio-modal__error">{error}</p> : null}
        <button type="button" className="btn btn-ghost web-studio-modal__close" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}

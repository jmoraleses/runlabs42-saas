'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import type { VercelPreviewStatus } from '@/hooks/useVercelPreview'

type VercelPreviewPanelProps = {
  status: VercelPreviewStatus
  url: string | null
  buildLog: string | null
  errorMessage: string | null
  onDeploy: () => void
  onCleanup?: () => void
  viewport?: 'sm' | 'md' | 'lg'
}

const VIEWPORT_WIDTH: Record<string, string> = {
  sm: '390px',
  md: '768px',
  lg: '100%',
}

export function VercelPreviewPanel({
  status,
  url,
  buildLog,
  errorMessage,
  onDeploy,
  onCleanup,
  viewport = 'lg',
}: VercelPreviewPanelProps) {
  const { t } = useApp() as { t: (key: string) => string }

  return (
    <div className="editor-preview-root editor-vercel-preview">
      <div className="editor-vercel-preview-toolbar">
        {status === 'idle' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onDeploy}>
            {t('ed.vercelPreview.deploy')}
          </button>
        ) : null}
        {status === 'deploying' ? (
          <span className="editor-sandbox-loading" role="status">
            {t('ed.vercelPreview.deploying')}
          </span>
        ) : null}
        {status === 'live' && onCleanup ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCleanup}>
            {t('ed.vercelPreview.cleanup')}
          </button>
        ) : null}
        {status === 'error' ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDeploy}>
            {t('ed.vercelPreview.retry')}
          </button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="editor-vercel-preview-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {buildLog && status !== 'live' ? (
        <pre className="editor-vercel-preview-log no-scrollbar">{buildLog.slice(-4000)}</pre>
      ) : null}

      {status === 'live' && url ? (
        <div
          className="editor-preview-device"
          style={{ width: VIEWPORT_WIDTH[viewport] ?? '100%', maxWidth: '100%', margin: '0 auto' }}
        >
          <iframe
            title="Vercel preview"
            src={url}
            className="editor-preview-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      ) : status === 'idle' ? (
        <p className="editor-vercel-preview-hint">{t('ed.vercelPreview.hint')}</p>
      ) : null}
    </div>
  )
}

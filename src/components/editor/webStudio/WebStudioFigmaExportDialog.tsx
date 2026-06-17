'use client'

import React, { useState } from 'react'
import { useApp } from '@/components/app/shell'
import { apiFetch } from '@/lib/api/client'

type ExportResult = {
  exportId: string
  downloadUrl: string
  pluginHint?: string
}

type WebStudioFigmaExportDialogProps = {
  projectId: string
  pageIds?: string[]
  onClose: () => void
}

export function WebStudioFigmaExportDialog({
  projectId,
  pageIds,
  onClose,
}: WebStudioFigmaExportDialogProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleExport() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<ExportResult>(`/api/projects/${projectId}/design/figma/export`, {
        method: 'POST',
        body: JSON.stringify({ pageIds: pageIds?.length ? pageIds : undefined }),
      })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ed.design.error'))
    } finally {
      setLoading(false)
    }
  }

  async function copyExportId() {
    if (!result?.exportId) return
    await navigator.clipboard.writeText(result.exportId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="web-studio-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="web-studio-modal"
        role="dialog"
        aria-labelledby="figma-export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="figma-export-title" className="web-studio-modal__title">
          {t('ed.design.figmaExportTitle')}
        </h3>
        {!result ? (
          <>
            <p className="web-studio-modal__desc">{t('ed.design.figmaExportDesc')}</p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={() => void handleExport()}
            >
              {loading ? t('ed.design.figmaExporting') : t('ed.design.figmaExportBtn')}
            </button>
          </>
        ) : (
          <>
            <p className="web-studio-modal__desc">{t('ed.design.figmaExportDone')}</p>
            <code className="web-studio-modal__code">{result.exportId}</code>
            <div className="web-studio-modal__actions">
              <button type="button" className="btn btn-primary" onClick={() => void copyExportId()}>
                {copied ? t('ed.design.copied') : t('ed.design.copyExportId')}
              </button>
              <a
                className="btn btn-ghost"
                href={result.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('ed.design.figmaDownloadBundle')}
              </a>
            </div>
            <p className="web-studio-modal__hint">{t('ed.design.figmaPluginHint')}</p>
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

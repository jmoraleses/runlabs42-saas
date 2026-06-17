'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import type { MobileCheck, MobileReadiness } from '@/types/mobile'

type MobileReadinessPanelProps = {
  readiness: MobileReadiness | null
  scanning: boolean
  onScan: () => void
  onApplyWithAi: (prompt: string) => void
}

function statusClass(status: MobileCheck['status']) {
  if (status === 'pass') return 'mobile-check--pass'
  if (status === 'partial') return 'mobile-check--partial'
  return 'mobile-check--fail'
}

export function MobileReadinessPanel({
  readiness,
  scanning,
  onScan,
  onApplyWithAi,
}: MobileReadinessPanelProps) {
  const { t } = useApp() as { t: (key: string) => string }

  const failed = readiness?.checks.filter((c) => c.status !== 'pass') ?? []
  const fixPrompt =
    failed.length > 0
      ? `/mobile-fix Corrige para tiendas móviles:\n${failed.map((c) => `- ${c.label}: ${c.message}`).join('\n')}`
      : ''

  return (
    <div className="mobile-readiness-panel">
      <div className="mobile-readiness-head">
        <div>
          <h3>{t('publish.mobile.readinessTitle')}</h3>
          <p className="text-muted">{t('publish.mobile.readinessDesc')}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={scanning} onClick={onScan}>
          {scanning ? '…' : t('publish.mobile.runScan')}
        </button>
      </div>

      {readiness ? (
        <>
          <div className="mobile-readiness-score">
            <span className="mobile-readiness-score-value">{readiness.score}</span>
            <span>{t('publish.mobile.scoreLabel')}</span>
          </div>
          <ul className="mobile-check-list">
            {readiness.checks.map((c) => (
              <li key={c.id} className={`mobile-check ${statusClass(c.status)}`}>
                <span className="mobile-check-label">{c.label}</span>
                <span className="mobile-check-msg">{c.message}</span>
              </li>
            ))}
          </ul>
          {failed.length > 0 ? (
            <div className="mobile-readiness-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onApplyWithAi(fixPrompt)}
              >
                {t('publish.mobile.applyWithAi')}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-muted">{t('publish.mobile.scanHint')}</p>
      )}
    </div>
  )
}

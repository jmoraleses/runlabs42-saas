'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

type TokenCostMeterProps = {
  sessionCost: number
  credits: number
  modelLabel?: string
}

export function TokenCostMeter({ sessionCost, credits, modelLabel }: TokenCostMeterProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const pct = credits > 0 ? Math.min(100, (sessionCost / credits) * 100) : 0

  return (
    <div className="token-cost-meter" title={t('ed.tokenCostHint')}>
      <div className="token-cost-meter-head">
        <span className="mono">{sessionCost.toFixed(1)} cr</span>
        <span className="token-cost-meter-label">{t('ed.sessionCost')}</span>
        {modelLabel ? <span className="token-cost-meter-model">{modelLabel}</span> : null}
        <span className="spacer" />
        <span
          className="mono token-cost-meter-balance"
          style={{ color: credits < 10 ? 'var(--warning)' : 'var(--success)' }}
        >
          {credits} cr
        </span>
      </div>
      <div className="token-cost-meter-bar">
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

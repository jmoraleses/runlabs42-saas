'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { shouldUseDemoData } from '@/lib/auth/demo'
import { formatT } from '@/lib/i18n'
import { useApp } from '@/components/app/shell'
import { useUser } from '@/hooks/useUser'

const CHART_DAYS = 14

export type CreditDay = {
  iso: string
  credits: number
  label: string
  weekday: string
}

function noonDate(offsetFromToday: number) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - offsetFromToday)
  return d
}

function localIso(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function buildCreditDays(
  transactions: { type: string; amount: number; createdAt: string }[] | undefined,
  totalDays = CHART_DAYS,
) {
  const byDay = new Map<string, number>()
  for (const tx of transactions ?? []) {
    if (tx.type !== 'debit') continue
    const day = tx.createdAt.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + tx.amount)
  }

  const days: CreditDay[] = []
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = noonDate(i)
    const iso = localIso(d)
    days.push({
      iso,
      credits: byDay.get(iso) ?? 0,
      label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      weekday: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
    })
  }
  return days
}

function demoDays(): CreditDay[] {
  const pattern = [0, 3, 7, 4, 11, 6, 2, 0, 5, 9, 14, 7, 2, 4]
  return buildCreditDays([]).map((d, i) => ({
    ...d,
    credits: pattern[i % pattern.length] ?? 0,
  }))
}

type CreditUsagePanelProps = {
  credits: number
  creditTotal: number
}

export function CreditUsagePanel({ credits, creditTotal }: CreditUsagePanelProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const { profile, loading: userLoading } = useUser()
  const [days, setDays] = useState<CreditDay[]>(() =>
    shouldUseDemoData(null) ? demoDays() : buildCreditDays([]),
  )
  const [hovered, setHovered] = useState<CreditDay | null>(null)

  useEffect(() => {
    if (userLoading) return
    if (shouldUseDemoData(profile)) {
      setDays(demoDays())
      return
    }
    if (!profile?.id) {
      setDays(buildCreditDays([]))
      return
    }
    apiFetch<{ transactions: { type: string; amount: number; createdAt: string }[] }>(
      '/api/user/transactions',
    )
      .then((d) => setDays(buildCreditDays(d.transactions)))
      .catch(() => setDays(buildCreditDays([])))
  }, [userLoading, profile])

  const spentPeriod = useMemo(() => days.reduce((s, d) => s + d.credits, 0), [days])
  const maxDay = useMemo(() => Math.max(0.5, ...days.map((d) => d.credits)), [days])
  const spentAccount = Math.max(0, creditTotal - credits)
  const creditsUsedPct =
    creditTotal > 0 ? Math.min(100, Math.round((spentAccount / creditTotal) * 100)) : 0
  const creditsAvailablePct =
    creditTotal > 0 ? Math.min(100, Math.round((credits / creditTotal) * 100)) : 0

  const active = hovered ?? days[days.length - 1]
  const chartLabels = useMemo(() => {
    if (days.length === 0) return []
    const picks = [0, Math.floor(days.length / 2), days.length - 1]
    return [...new Set(picks)].map((i) => days[i]).filter((d): d is CreditDay => d != null)
  }, [days])

  const ringRadius = 36
  const ringCirc = 2 * Math.PI * ringRadius
  const ringOffset = ringCirc - (creditsAvailablePct / 100) * ringCirc

  return (
    <section className="credit-activity" aria-label={t('dash.usage')}>
      <header className="credit-activity-header">
        <h2 className="credit-activity-title">{t('dash.usage')}</h2>
      </header>
      <div className="credit-activity-card">
        <p className="credit-activity-lead">{t('dash.usageHint')}</p>
        <div className="credit-activity-summary">
        <div className="credit-activity-ring" aria-hidden>
          <svg viewBox="0 0 88 88" className="credit-activity-ring-svg">
            <circle
              className="credit-activity-ring-bg"
              cx="44"
              cy="44"
              r={ringRadius}
              fill="none"
              strokeWidth="6"
            />
            <circle
              className="credit-activity-ring-fill"
              cx="44"
              cy="44"
              r={ringRadius}
              fill="none"
              strokeWidth="6"
              strokeDasharray={ringCirc}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              transform="rotate(-90 44 44)"
              data-low={creditsAvailablePct <= 20 ? 'true' : undefined}
              data-mid={creditsAvailablePct > 20 && creditsAvailablePct <= 50 ? 'true' : undefined}
            />
          </svg>
          <span className="credit-activity-ring-value mono">{credits}</span>
        </div>
        <div className="credit-activity-stats">
          <p className="credit-activity-stats-label">{t('dash.metric.available')}</p>
          <p className="credit-activity-stats-main">
            <span className="mono">{credits}</span>
            <span className="credit-activity-stats-of"> / {creditTotal}</span>
          </p>
          <div className="credit-activity-stats-row">
            <span>
              {t('dash.metric.period')}:{' '}
              <strong className="mono">{Math.round(spentPeriod * 10) / 10}</strong> cr
            </span>
            <span>
              {t('dash.metric.used')}: <strong className="mono">{creditsUsedPct}%</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="credit-activity-chart">
        <div className="credit-activity-chart-head">
          {active && (
            <span className="credit-activity-chart-focus mono" role="status">
              {active.label} ·{' '}
              {formatT(t, 'dash.daySpent', { n: String(Math.round(active.credits * 10) / 10) })}
            </span>
          )}
        </div>
        <div className="credit-activity-bars" role="img" aria-label={t('dash.activity')}>
          {days.map((day) => {
            const h = maxDay > 0 ? Math.max(4, Math.round((day.credits / maxDay) * 100)) : 4
            const isActive = active?.iso === day.iso
            return (
              <button
                key={day.iso}
                type="button"
                className={`credit-activity-bar${isActive ? ' is-active' : ''}`}
                style={{ '--h': `${h}%` } as React.CSSProperties}
                aria-label={`${day.label}: ${day.credits} cr`}
                onMouseEnter={() => setHovered(day)}
                onFocus={() => setHovered(day)}
                onMouseLeave={() => setHovered(null)}
                onBlur={() => setHovered(null)}
              >
                <span className="credit-activity-bar-fill" />
              </button>
            )
          })}
        </div>
        <div className="credit-activity-chart-axis" aria-hidden>
          {chartLabels.map((d) => (
            <span key={d.iso}>{d.label}</span>
          ))}
        </div>
      </div>
      </div>
    </section>
  )
}

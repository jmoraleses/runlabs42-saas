'use client'

import React, { useState } from 'react'
import { Icon, useApp } from '@/components/app/shell'

type BannerType = 'vercel' | 'github'

interface IntegrationReminderBannerProps {
  type: BannerType
  connectHref?: string
}

export function IntegrationReminderBanner({
  type,
  connectHref = '/settings?tab=connect',
}: IntegrationReminderBannerProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const messageKey = type === 'vercel' ? 'int.banner.vercel.message' : 'int.banner.github.message'
  const linkKey = type === 'vercel' ? 'int.banner.vercel.link' : 'int.banner.github.link'

  return (
    <div
      role="status"
      className={`integration-reminder-banner integration-reminder-banner--${type}`}
    >
      {type === 'vercel' ? (
        <Icon.Vercel className="integration-reminder-banner__icon" aria-hidden />
      ) : (
        <Icon.Github className="integration-reminder-banner__icon" aria-hidden />
      )}
      <span className="integration-reminder-banner__text">
        {t(messageKey)}{' '}
        <a href={connectHref} className="integration-reminder-banner__link">
          {t(linkKey)}
        </a>
      </span>
      <button
        type="button"
        className="integration-reminder-banner__dismiss"
        aria-label={t('int.banner.dismiss')}
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </div>
  )
}

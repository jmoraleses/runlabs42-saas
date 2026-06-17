'use client'

import React from 'react'
import type { TargetPlatform } from '@/types/mobile'

const LABELS: Record<TargetPlatform, string> = {
  web: 'Web',
  ios: 'iOS',
  android: 'Android',
}

const CLASS: Record<TargetPlatform, string> = {
  web: 'platform-badge--web',
  ios: 'platform-badge--ios',
  android: 'platform-badge--android',
}

function PlatformIcon({ platform }: { platform: TargetPlatform }) {
  switch (platform) {
    case 'web':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    case 'ios':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
      )
    case 'android':
      return (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
          <path d="M17.6 9.48l1.84-3.18c.16-.28.06-.64-.26-.76-.28-.1-.61.06-.73.36l-1.86 3.22c-1.03-.49-2.18-.76-3.39-.76s-2.36.27-3.39.76L8.69 5.9c-.12-.3-.45-.46-.73-.36-.32.12-.42.48-.26.76l1.84 3.18C6.66 11.53 5 14.29 5 17.5h14c0-3.21-1.66-5.97-4.4-8.02zM9 14.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
        </svg>
      )
    default:
      return null
  }
}

export function PlatformBadge({ platform }: { platform: TargetPlatform }) {
  return (
    <span className={`platform-badge ${CLASS[platform]}`} title={LABELS[platform]}>
      <PlatformIcon platform={platform} />
      <span className="platform-badge__label">{LABELS[platform]}</span>
    </span>
  )
}

export function PlatformBadgeRow({
  platforms,
  className,
}: {
  platforms: TargetPlatform[]
  className?: string
}) {
  if (!platforms.length) return null
  return (
    <span className={['platform-badge-row', className].filter(Boolean).join(' ')}>
      {platforms.map((p) => (
        <PlatformBadge key={p} platform={p} />
      ))}
    </span>
  )
}

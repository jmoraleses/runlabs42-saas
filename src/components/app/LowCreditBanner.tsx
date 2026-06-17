'use client'

import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'

const THRESHOLD = 10

export function LowCreditBanner() {
  const { profile } = useUser()
  const router = useRouter()
  const credits = profile?.credits

  if (credits == null || credits >= THRESHOLD) return null

  return (
    <div
      role="status"
      style={{
        background: 'color-mix(in srgb, var(--warning, #f59e0b) 12%, var(--surface))',
        borderBottom: '1px solid var(--border)',
        padding: '8px 16px',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <span>
        Te quedan <strong>{credits}</strong> créditos.
      </span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push('/settings?tab=billing')}>
        Recargar
      </button>
    </div>
  )
}

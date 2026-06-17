'use client'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

/** Analytics solo cuando el sitio es público (lanzamiento). */
export function VercelInsights() {
  if (process.env.NEXT_PUBLIC_SITE_PUBLIC !== 'true') return null
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}

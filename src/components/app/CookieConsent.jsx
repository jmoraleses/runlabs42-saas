'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '@/components/app/shell'
import { LEGAL_ROUTES } from '@/lib/legal/getLegalDocument'

const CONSENT_KEY = 'sk.cookie_consent'

export function CookieConsent() {
  const { t, navigate } = useApp()
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(CONSENT_KEY)
    if (!stored) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setVisible(false)
  }

  if (!mounted || !visible) return null

  return createPortal(
    <div
      className="cookie-consent"
      role="dialog"
      aria-label={t('cookie.banner.title')}
      aria-live="polite"
    >
      <div className="cookie-consent-card">
        <p className="cookie-consent-text">
          {t('cookie.banner.message')}{' '}
          <a
            href={LEGAL_ROUTES.cookies}
            onClick={(e) => {
              e.preventDefault()
              navigate(LEGAL_ROUTES.cookies)
            }}
          >
            {t('cookie.banner.learnMore')}
          </a>
        </p>
        <div className="cookie-consent-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={decline}>
            {t('cookie.banner.decline')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={accept}>
            {t('cookie.banner.accept')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

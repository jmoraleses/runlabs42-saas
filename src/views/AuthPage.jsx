'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useApp, Icon, MarketingShell } from '@/components/app/shell'
import { signInWithOAuth } from '@/lib/auth/client'
import { formatAuthError, formatAuthErrorHint } from '@/lib/auth/errors'
import { hasRealAccount } from '@/lib/auth/demo'
import { SUPABASE_OAUTH_CALLBACK } from '@/lib/supabase/project'
import { useUser } from '@/hooks/useUser'

// Runlabs42 — Auth (GitHub & Google only)

function AuthPage({ mode }) {
  const { t, navigate } = useApp()
  const searchParams = useSearchParams()
  const isSignup = mode === 'signup'
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)
  const [showOAuthSetup, setShowOAuthSetup] = useState(false)
  const { user, profile, loading: authLoading } = useUser()

  const supabaseCallback = SUPABASE_OAUTH_CALLBACK
  const nextPath = searchParams.get('next') || '/'

  useEffect(() => {
    if (authLoading) return
    if (hasRealAccount(user, profile)) {
      navigate(nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/')
    }
  }, [authLoading, user, profile, nextPath, navigate])

  const errorHint = formatAuthErrorHint(searchParams.get('hint'))

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) {
      const decoded = decodeURIComponent(err)
      setError(formatAuthError(decoded))
      if (
        decoded.includes('provider') ||
        decoded.includes('Unsupported provider') ||
        err === 'auth_callback' ||
        decoded.includes('Unable to exchange external code') ||
        decoded.includes('code verifier')
      ) {
        setShowOAuthSetup(true)
      }
    }
  }, [searchParams])

  async function handleOAuth(provider) {
    setLoading(provider)
    setError(null)
    setShowOAuthSetup(false)
    const { error: authError } = await signInWithOAuth(provider, nextPath)
    if (authError) {
      setError(formatAuthError(authError, provider))
      setShowOAuthSetup(
        String(authError.message || '').includes('provider is not enabled') ||
          String(authError.message || '').includes('Unsupported provider'),
      )
      setLoading(null)
    }
  }

  return (
    <MarketingShell>
      <section
        style={{
          minHeight: 'calc(100vh - 60px)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          <div style={{ width: '100%', maxWidth: 380 }}>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 36, letterSpacing: '-0.03em', marginBottom: 8 }}>
                {isSignup ? t('auth.signup.title') : t('auth.signin.title')}
              </h1>
              <p style={{ color: 'var(--text-mid)', fontSize: 14.5 }}>
                {isSignup ? t('auth.signup.sub') : t('auth.signin.sub')}
              </p>
            </div>

            {error && (
              <div role="alert" className="form-error" style={{ marginBottom: 14 }}>
                {error}
                {errorHint && (
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-mid)' }}>
                    {errorHint}
                  </p>
                )}
                {showOAuthSetup && supabaseCallback && (
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-mid)' }}>
                    Activa el proveedor en Supabase → Authentication → Providers y registra esta
                    callback en GitHub/Google:{' '}
                    <code style={{ fontSize: 11, wordBreak: 'break-all', color: 'var(--text)' }}>
                      {supabaseCallback}
                    </code>
                  </p>
                )}
              </div>
            )}

            <p
              style={{
                fontSize: 13,
                color: 'var(--text-mid)',
                marginBottom: 20,
                lineHeight: 1.55,
              }}
            >
              {t('auth.oauth.only')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <button
                type="button"
                disabled={!!loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px 14px', justifyContent: 'center' }}
                onClick={() => handleOAuth('github')}
              >
                <Icon.Github />
                {loading === 'github'
                  ? '…'
                  : isSignup
                    ? t('auth.oauth.github.signup')
                    : t('auth.oauth.github.signin')}
              </button>
              <button
                type="button"
                disabled={!!loading}
                className="btn btn-ghost"
                style={{ width: '100%', padding: '12px 14px', justifyContent: 'center' }}
                onClick={() => handleOAuth('google')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.12A6.59 6.59 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.47 1.18 4.96l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.27 9.14 5.38 12 5.38z"
                  />
                </svg>
                {loading === 'google'
                  ? '…'
                  : isSignup
                    ? t('auth.oauth.google.signup')
                    : t('auth.oauth.google.signin')}
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20, lineHeight: 1.5 }}>
              {t('auth.terms.prefix')}{' '}
              <a
                href="/legal/terms"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/legal/terms')
                }}
                style={{ color: 'var(--accent)' }}
              >
                {t('footer.terms')}
              </a>{' '}
              {t('auth.terms.and')}{' '}
              <a
                href="/legal/privacy"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/legal/privacy')
                }}
                style={{ color: 'var(--accent)' }}
              >
                {t('footer.privacy')}
              </a>
              .
            </p>

            <div style={{ marginTop: 28, fontSize: 13.5, color: 'var(--text-mid)' }}>
              {isSignup ? t('auth.toggle.signin') : t('auth.toggle.signup')}{' '}
              <a
                href={'/auth/' + (isSignup ? 'signin' : 'signup')}
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/auth/' + (isSignup ? 'signin' : 'signup'))
                }}
                style={{ color: 'var(--accent)', fontWeight: 500 }}
              >
                {isSignup ? t('auth.signin.btn') : t('auth.signup.btn')}
              </a>
            </div>
          </div>
        </div>

        {/* Right side — visual */}
        <div
          style={{
            background: 'var(--bg-elev)',
            borderLeft: '1px solid var(--border)',
            position: 'relative',
            overflow: 'hidden',
            padding: 60,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            className="bg-grid"
            style={{
              position: 'absolute',
              inset: 0,
              maskImage: 'radial-gradient(ellipse at 30% 50%, black 30%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 30% 50%, black 30%, transparent 70%)',
              opacity: 0.6,
            }}
          />
          <div
            className="gradient-orb"
            style={{
              width: 500,
              height: 500,
              left: '20%',
              top: '30%',
              background: 'radial-gradient(circle, rgba(79,124,255,0.3), transparent 65%)',
            }}
          />
          <div
            className="gradient-orb"
            style={{
              width: 400,
              height: 400,
              right: '10%',
              bottom: '10%',
              background: 'radial-gradient(circle, rgba(176,124,255,0.28), transparent 65%)',
            }}
          />

          <div style={{ position: 'relative', maxWidth: 460 }}>
            <div className="eyebrow" style={{ marginBottom: 18 }}>
              Welcome
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                marginBottom: 28,
                textWrap: 'balance',
              }}
            >
              "Runlabs42 cut my MVP time from 3 weeks to 4 days. No terminal, no installs — just my
              browser and a prompt."
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                }}
              >
                MC
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Maya Chen</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Indie hacker · shipped 4 SaaS with Runlabs42
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 50,
                display: 'flex',
                gap: 24,
                paddingTop: 28,
                borderTop: '1px solid var(--border)',
              }}
            >
              {[
                { v: '12.4k', l: 'Active builders' },
                { v: '47K', l: 'Credits today' },
                { v: '99.99%', l: 'Uptime / 90d' },
              ].map((s) => (
                <div key={s.l}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>
                    {s.v}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}

export { AuthPage }

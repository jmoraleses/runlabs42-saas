'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useApp, Icon, MarketingShell } from '@/components/app/shell'

function ContactPage() {
  const { t, navigate } = useApp()
  const searchParams = useSearchParams()
  const topic = searchParams.get('topic') === 'enterprise' ? 'enterprise' : 'general'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]')
    const prev = meta?.getAttribute('content') ?? null
    if (meta) meta.setAttribute('content', 'noindex, nofollow')
    return () => {
      if (meta && prev !== null) meta.setAttribute('content', prev)
    }
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company: company || undefined, message, topic }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || t('contact.error.generic'))
        return
      }

      if (data.mailtoFallback && data.mailtoUrl) {
        window.location.href = data.mailtoUrl
      }

      setSent(true)
    } catch {
      setError(t('contact.error.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <MarketingShell>
      <section className="contact-page">
        <div className="contact-page-bg bg-grid" aria-hidden />
        <div className="container contact-page-inner">
          <header className="app-page-header contact-page-header">
            <button
              type="button"
              className="btn btn-ghost btn-sm contact-page-back"
              onClick={() => navigate('/pricing')}
            >
              <Icon.Arrow style={{ transform: 'rotate(180deg)' }} />
              {t('contact.back')}
            </button>
            <p className="eyebrow">{topic === 'enterprise' ? t('plan.ent') : t('contact.eyebrow')}</p>
            <h1>{t('contact.title')}</h1>
            <p className="app-page-header__lead">{t('contact.subtitle')}</p>
          </header>

          <div className="contact-page-body">
          {sent ? (
            <div className="contact-page-success" role="status">
              <h2>{t('contact.success.title')}</h2>
              <p>{t('contact.success.body')}</p>
              <button type="button" className="btn btn-primary" onClick={() => navigate('/pricing')}>
                {t('contact.backPricing')}
              </button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={onSubmit} noValidate>
              {error ? (
                <div role="alert" className="form-error contact-form-error">
                  {error}
                </div>
              ) : null}

              <div className="contact-form-grid">
                <div className="contact-field">
                  <label htmlFor="contact-name">{t('contact.name')}</label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="contact-field">
                  <label htmlFor="contact-email">{t('contact.email')}</label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="contact-field">
                <label htmlFor="contact-company">{t('contact.company')}</label>
                <input
                  id="contact-company"
                  name="company"
                  type="text"
                  autoComplete="organization"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>

              <div className="contact-field">
                <label htmlFor="contact-message">{t('contact.message')}</label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div className="contact-form-actions">
                <p className="contact-form-hint">{t('contact.hint')}</p>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? t('contact.sending') : t('contact.submit')}
                  {!loading && <Icon.Arrow />}
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}

export { ContactPage }

'use client'

import React, { useState } from 'react'
import { useApp, Icon, MarketingShell } from '@/components/app/shell'
import { useUser } from '@/hooks/useUser'
import {
  billingUrlForPlan,
  getPricingPlans,
} from '@/lib/pricing/plans'

const _USD_PER_CREDIT = 0.01
const _REQUEST_INPUT_TOKENS = 3000
const _REQUEST_OUTPUT_TOKENS = 1000
const AVG_PROJECT_SIZE_GB = 0.25
const YEARLY_PRICE_BY_PLAN = {
  starter: 15,
  builder: 39,
  pro: 79,
}
function PricingPage() {
  const { t, navigate } = useApp()
  const { isAuthenticated } = useUser()
  const [yearly, setYearly] = useState(false)

  function planButtonLabel(plan) {
    if (plan.id === 'free') return plan.cta
    if (isAuthenticated) return t('pricing.subscribe')
    return plan.cta
  }

  function planCta(planId) {
    if (planId === 'free') {
      if (isAuthenticated) {
        navigate('/')
        return
      }
      navigate('/auth/signup')
      return
    }

    const billingPath = billingUrlForPlan(planId)
    if (!isAuthenticated) {
      navigate(`/auth/signin?next=${encodeURIComponent(billingPath)}`)
      return
    }
    navigate(billingPath)
  }

  const plans = getPricingPlans(t)

  return (
    <MarketingShell>
      <section className="pricing-page">
        <div className="pricing-page-bg bg-grid" aria-hidden />
        <div className="container pricing-page-inner">
          <header className="app-page-header app-page-header--row pricing-page-header">
            <div className="app-page-header__main pricing-page-intro">
              <p className="eyebrow">{t('pp.eyebrow')}</p>
              <h1>{t('pp.title')}</h1>
              <p className="app-page-header__lead">{t('pp.subtitle')}</p>
            </div>
            <BillingToggle yearly={yearly} setYearly={setYearly} t={t} />
          </header>

          <div className="pricing-page-grid pricing-page-grid--5">
            {plans.map((p) => {
              const price = yearly
                ? (YEARLY_PRICE_BY_PLAN[p.id] ?? p.price)
                : p.price
              const ctaClass =
                p.ctaStyle === 'accent'
                  ? 'btn btn-accent'
                  : p.ctaStyle === 'primary'
                    ? 'btn btn-primary'
                    : 'btn btn-ghost'
              return (
                <article
                  key={p.id}
                  className={`pricing-plan${p.popular ? ' pricing-plan--popular' : ''}`}
                >
                  {p.popular && (
                    <span className="pricing-plan-badge pill">{t('pricing.popular')}</span>
                  )}
                  <div className="pricing-plan-head">
                    <h2>{p.name}</h2>
                  </div>
                  <div className="pricing-plan-price">
                    <span className="pricing-plan-price-value">${price}</span>
                    <span className="pricing-plan-price-period">/mo</span>
                  </div>
                  <div className="pricing-plan-includes">
                    <p className="pricing-plan-includes-title">{t('pricing.includesTitle')}</p>
                    <ul>
                      <li>
                        {p.msgCredits.toLocaleString()} {t('pricing.creditLine.messages')}
                      </li>
                      <li>
                        {t('pricing.storage').replace('{gb}', p.storageGb.toLocaleString())}
                      </li>
                      <li>
                        {t('pricing.projectsEstimate')
                          .replace('{projects}', Math.floor(p.storageGb / AVG_PROJECT_SIZE_GB).toLocaleString())}
                      </li>
                      <li>{t('pricing.marketplaceUnlimited')}</li>
                      {(p.summaryKeys ?? []).map((key) => (
                        <li key={key}>{t(key)}</li>
                      ))}
                    </ul>
                  </div>
                  <button type="button" onClick={() => planCta(p.id)} className={ctaClass}>
                    {planButtonLabel(p)}
                  </button>
                </article>
              )
            })}
          </div>

          <EnterpriseCta t={t} navigate={navigate} />
        </div>
      </section>

      <FAQ />
    </MarketingShell>
  )
}

function EnterpriseCta({ t, navigate }) {
  return (
    <div className="pricing-enterprise-cta">
      <div>
        <h3>{t('plan.ent')}</h3>
        <p>{t('plan.ent.tag')}</p>
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => navigate('/contact?topic=enterprise')}
      >
        {t('pricing.cta.ent')}
      </button>
    </div>
  )
}

function BillingToggle({ yearly, setYearly, t }) {
  return (
    <div className="pricing-billing-toggle" role="group" aria-label={t('pricing.monthly')}>
      {[
        { v: false, label: t('pricing.monthly') },
        { v: true, label: t('pricing.yearly') },
      ].map((opt) => (
        <button
          key={String(opt.v)}
          type="button"
          aria-pressed={yearly === opt.v}
          onClick={() => setYearly(opt.v)}
          className={yearly === opt.v ? 'is-active' : ''}
        >
          {opt.label}
          {opt.v && <span className="pricing-billing-save mono">-20%</span>}
        </button>
      ))}
    </div>
  )
}

function FAQ() {
  const { t } = useApp()
  const items = [
    { q: t('faq.q1'), a: t('faq.a1') },
    { q: t('faq.q2'), a: t('faq.a2') },
    { q: t('faq.q3'), a: t('faq.a3') },
    { q: t('faq.q4'), a: t('faq.a4') },
    { q: t('faq.q5'), a: t('faq.a5') },
    { q: t('faq.q6'), a: t('faq.a6') },
  ]
  const [open, setOpen] = useState(-1)
  return (
    <section className="pricing-faq">
      <div className="container pricing-faq-inner">
        <h2>{t('faq.title')}</h2>
        <div className="pricing-faq-list">
          {items.map((it, i) => (
            <div key={i} className="pricing-faq-item">
              <button
                type="button"
                className="pricing-faq-trigger"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <span>{it.q}</span>
                <span className={`pricing-faq-icon${open === i ? ' is-open' : ''}`}>
                  <Icon.Plus />
                </span>
              </button>
              <div className={`pricing-faq-panel${open === i ? ' is-open' : ''}`}>
                <p>{it.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export { PricingPage }

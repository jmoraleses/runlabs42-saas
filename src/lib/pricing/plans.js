/**
 * Planes Runlabs42 — alineados con tiers de Base44 pero a menor precio.
 * Base44 (ref. may 2026): Free $0, Starter $20, Builder $50, Pro $100, Elite $200.
 */

/** Importe sugerido (€) al ir a facturación desde un plan de precios. */
export function planIdToSuggestedAmountEur(planId) {
  const map = {
    starter: 19,
    builder: 49,
    pro: 99,
  }
  return map[planId] ?? null
}

export function billingUrlForPlan(planId) {
  const amount = planIdToSuggestedAmountEur(planId)
  if (!amount) return '/settings?tab=billing'
  return `/settings?tab=billing&amount=${amount}`
}

export function getPricingPlans(t) {
  return [
    {
      id: 'free',
      name: t('plan.free'),
      tag: t('plan.free.tag'),
      price: 0,
      base44Price: 0,
      msgCredits: 25,
      intCredits: 600,
      storageGb: 1,
      base44Msg: 25,
      base44Int: 500,
      cta: t('pricing.cta.free'),
      ctaStyle: 'ghost',
      summaryKeys: [],
      featureKeys: [
        'plan.feat.core',
        'plan.feat.auth',
        'plan.feat.db',
        'plan.feat.analytics',
        'plan.feat.community',
      ],
    },
    {
      id: 'starter',
      name: t('plan.starter'),
      tag: t('plan.starter.tag'),
      price: 19,
      base44Price: 20,
      msgCredits: 100,
      intCredits: 4000,
      storageGb: 10,
      base44Msg: 100,
      base44Int: 2000,
      cta: t('pricing.cta.starter'),
      ctaStyle: 'ghost',
      summaryKeys: [],
      featureKeys: [
        'plan.feat.allFree',
        'plan.feat.unlimitedApps',
        'plan.feat.inAppCode',
        'plan.feat.allModelsLite',
        'plan.feat.marketplaceRead',
      ],
    },
    {
      id: 'builder',
      name: t('plan.builder'),
      tag: t('plan.builder.tag'),
      price: 49,
      base44Price: 50,
      msgCredits: 250,
      intCredits: 18000,
      storageGb: 50,
      base44Msg: 250,
      base44Int: 10000,
      popular: true,
      cta: t('pricing.cta.builder'),
      ctaStyle: 'accent',
      summaryKeys: [],
      featureKeys: [
        'plan.feat.allStarter',
        'plan.feat.customDomains',
        'plan.feat.github',
        'plan.feat.publish5',
        'plan.feat.emailSupport',
      ],
    },
    {
      id: 'pro',
      name: t('plan.pro'),
      tag: t('plan.pro.tag'),
      price: 99,
      base44Price: 100,
      msgCredits: 500,
      intCredits: 45000,
      storageGb: 200,
      base44Msg: 500,
      base44Int: 20000,
      cta: t('pricing.cta.pro'),
      ctaStyle: 'ghost',
      summaryKeys: [],
      featureKeys: [
        'plan.feat.allBuilder',
        'plan.feat.beta',
        'plan.feat.allModels',
        'plan.feat.unlimitedPublish',
        'plan.feat.priority',
      ],
    },
  ]
}

/** Planes resumidos para la landing (3 columnas). */
export function getLandingPricingPlans(t) {
  const all = getPricingPlans(t)
  return [all[0], all[1], all[3]].map((p) => ({
    ...p,
    tokens: String(p.msgCredits),
    features: p.featureKeys.slice(0, 4).map((k) => t(k)),
  }))
}

export const PRICING_INCLUDED_KEYS = [
  'plan.included.ai',
  'plan.included.backend',
  'plan.included.editor',
  'plan.included.analytics',
  'plan.included.collab',
  'plan.included.storage',
  'plan.included.auth',
  'plan.included.payments',
  'plan.included.email',
  'plan.included.debug',
]

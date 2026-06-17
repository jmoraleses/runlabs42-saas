/**
 * Planes de suscripción mensual de Runlabs42.
 * Los precios se crean inline en Stripe Checkout con price_data + recurring,
 * sin necesidad de pre-crear productos en el dashboard.
 */

export type PlanId = 'starter' | 'builder' | 'pro'

export type SubscriptionPlan = {
  id: PlanId
  name: string
  priceEur: number          // precio mensual en €
  credits: number           // créditos mensuales incluidos
  stripePriceEnvKey: string // env var opcional para price ID pre-creado
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceEur: 19,
    credits: 100,
    stripePriceEnvKey: 'STRIPE_PRICE_STARTER',
  },
  {
    id: 'builder',
    name: 'Builder',
    priceEur: 49,
    credits: 250,
    stripePriceEnvKey: 'STRIPE_PRICE_BUILDER',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceEur: 99,
    credits: 500,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO',
  },
]

export function getPlanById(id: string): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id) ?? null
}

/** Devuelve el price ID de Stripe si está configurado en env, o null para usar price_data inline. */
export function getStripePriceId(plan: SubscriptionPlan): string | null {
  return process.env[plan.stripePriceEnvKey]?.trim() || null
}

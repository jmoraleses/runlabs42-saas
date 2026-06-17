/** Stripe credit packs — map env price IDs when configured in Stripe Dashboard. */
export const STRIPE_PACKS = {
  starter: {
    id: 'starter',
    credits: 50,
    amount: 1000,
    priceId: process.env.STRIPE_PRICE_STARTER,
    label: 'Starter',
  },
  pro: {
    id: 'pro',
    credits: 120,
    amount: 2500,
    priceId: process.env.STRIPE_PRICE_PRO,
    label: 'Pro',
  },
  team: {
    id: 'team',
    credits: 300,
    amount: 5000,
    priceId: process.env.STRIPE_PRICE_TEAM,
    label: 'Team',
  },
} as const

export type StripePackId = keyof typeof STRIPE_PACKS

export function getStripePack(packId: string) {
  return STRIPE_PACKS[packId as StripePackId] ?? null
}

export function listStripePacks() {
  return Object.values(STRIPE_PACKS)
}

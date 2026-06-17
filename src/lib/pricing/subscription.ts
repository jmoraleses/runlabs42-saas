/** Planes sin suscripción de pago (solo free tier o demo). */
const UNPAID_PLANS = new Set(['free', 'demo', ''])

export function hasPaidSubscription(plan?: string | null): boolean {
  const id = (plan ?? 'free').trim().toLowerCase()
  return Boolean(id) && !UNPAID_PLANS.has(id)
}

import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import Stripe from 'stripe'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { hasPaidSubscription } from '@/lib/pricing/subscription'

const CANCELLABLE_STATUSES = new Set(['active', 'trialing', 'past_due'])

export async function GET(request: Request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY
    const { user, supabase } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'sub-status'), 30, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const { data: userRow } = await supabase
      .from('users')
      .select(
        'plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end',
      )
      .eq('id', user.id)
      .single()

    let subscriptionId = userRow?.stripe_subscription_id ?? null
    let status = userRow?.subscription_status ?? 'none'
    let periodEnd = userRow?.subscription_period_end ?? null

    // Sincronizar desde Stripe si la BD no tiene la suscripción
    if (!subscriptionId && userRow?.stripe_customer_id && secret) {
      const stripe = new Stripe(secret, { apiVersion: '2023-10-16' })
      const { data: subs } = await stripe.subscriptions.list({
        customer: userRow.stripe_customer_id,
        status: 'all',
        limit: 10,
      })
      const sub = subs.find((s) => CANCELLABLE_STATUSES.has(s.status) || s.cancel_at_period_end)
      if (sub) {
        subscriptionId = sub.id
        status = sub.cancel_at_period_end ? 'canceling' : sub.status
        periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null

        await supabase
          .from('users')
          .update({
            stripe_subscription_id: sub.id,
            subscription_status: status,
            subscription_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
      }
    }

    const canCancel =
      !!subscriptionId && CANCELLABLE_STATUSES.has(status)

    const hasPaidPlan = hasPaidSubscription(userRow?.plan)

    return NextResponse.json({
      canCancel,
      hasPaidPlan,
      subscriptionStatus: status,
      subscriptionPeriodEnd: periodEnd,
      stripeSubscriptionId: subscriptionId,
      hasStripeCustomer: !!userRow?.stripe_customer_id,
    })
  } catch (e) {
    return jsonError(e)
  }
}

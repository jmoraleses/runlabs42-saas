import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import Stripe from 'stripe'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) throw new ApiError(503, 'Stripe no está configurado')

    const { user, supabase } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'sub-cancel'), 3, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const { data: userRow } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', user.id)
      .single()

    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' })

    let subscriptionId = userRow?.stripe_subscription_id ?? null

    // Buscar suscripción activa en Stripe si no está en la BD
    if (!subscriptionId && userRow?.stripe_customer_id) {
      const { data: subs } = await stripe.subscriptions.list({
        customer: userRow.stripe_customer_id,
        status: 'all',
        limit: 10,
      })
      const active = subs.find((s) =>
        ['active', 'trialing', 'past_due'].includes(s.status),
      )
      subscriptionId = active?.id ?? null
    }

    if (!subscriptionId) {
      throw new ApiError(404, 'No tienes ninguna suscripción activa')
    }

    const cancellable = ['active', 'trialing', 'past_due']
    if (
      userRow?.subscription_status &&
      !cancellable.includes(userRow.subscription_status)
    ) {
      // Verificar estado real en Stripe por si la BD está desactualizada
      const current = await stripe.subscriptions.retrieve(subscriptionId)
      if (!cancellable.includes(current.status)) {
        throw new ApiError(400, 'La suscripción no se puede cancelar en su estado actual')
      }
    }

    // Cancelar al final del período (no inmediatamente) para no perder acceso ya pagado
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })

    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null

    await supabase
      .from('users')
      .update({
        stripe_subscription_id: subscriptionId,
        subscription_status: 'canceling',
        subscription_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    const cancelAt = subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : periodEnd

    return NextResponse.json({
      ok: true,
      cancelAt,
    })
  } catch (e) {
    return jsonError(e)
  }
}

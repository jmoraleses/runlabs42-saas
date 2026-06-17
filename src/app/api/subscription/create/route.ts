import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import Stripe from 'stripe'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { getAppUrl } from '@/lib/env'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { getPlanById, getStripePriceId } from '@/lib/stripe/plans'

export async function POST(request: Request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) throw new ApiError(503, 'Stripe no está configurado')

    const { user, supabase } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'subscription'), 5, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const { planId } = body as { planId: string }

    const plan = getPlanById(planId)
    if (!plan) throw new ApiError(400, 'Plan no válido')

    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' })
    const appUrl = getAppUrl()

    // Obtener o crear customer de Stripe
    const { data: userRow } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', user.id)
      .single()

    // Si ya tiene suscripción activa, redirigir al portal
    if (
      userRow?.stripe_subscription_id &&
      ['active', 'trialing'].includes(userRow?.subscription_status ?? '')
    ) {
      throw new ApiError(409, 'Ya tienes una suscripción activa. Usa el portal para cambiarla.')
    }

    let customerId = userRow?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      })
      customerId = customer.id

      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Construir line item: usar price ID pre-creado o inline price_data
    const priceId = getStripePriceId(plan)
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: 'eur',
            unit_amount: plan.priceEur * 100,
            recurring: { interval: 'month' as const },
            product_data: {
              name: `Runlabs42 ${plan.name}`,
              description: `${plan.credits} créditos/mes · Facturación mensual`,
            },
          },
          quantity: 1,
        }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [lineItem],
      metadata: {
        userId: user.id,
        planId: plan.id,
        credits: String(plan.credits),
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planId: plan.id,
        },
      },
      success_url: `${appUrl}/settings?tab=billing&subscribed=1`,
      cancel_url: `${appUrl}/pricing?canceled=1`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    return jsonError(e)
  }
}

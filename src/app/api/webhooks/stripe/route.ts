import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function stripe(secret: string) {
  return new Stripe(secret, { apiVersion: '2023-10-16' })
}

async function getAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('falta SUPABASE_SERVICE_ROLE_KEY')
  }
  return createAdminClient()
}

// ---------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe no está configurado' }, { status: 503 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Falta la firma de Stripe' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe(secret).webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma inválida'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // eslint-disable-next-line no-console
  console.info('[stripe-webhook]', { eventId: event.id, type: event.type })

  try {
    switch (event.type) {
      // ----------------------------------------------------------
      // Pago único de créditos
      // ----------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'payment') {
          await handleCreditsPurchase(session, secret)
        } else if (session.mode === 'subscription') {
          await handleSubscriptionCheckout(session)
        }
        break
      }

      // ----------------------------------------------------------
      // Suscripción creada / actualizada
      // ----------------------------------------------------------
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(sub)
        break
      }

      // ----------------------------------------------------------
      // Suscripción cancelada / eliminada
      // ----------------------------------------------------------
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(sub)
        break
      }

      // ----------------------------------------------------------
      // Factura pagada (renovación mensual → reponer créditos)
      // ----------------------------------------------------------
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.billing_reason === 'subscription_cycle') {
          await handleSubscriptionRenewal(invoice, secret)
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error', { type: event.type, err })
    // No devolvemos 500 para evitar que Stripe reintente indefinidamente
  }

  return NextResponse.json({ received: true })
}

// ---------------------------------------------------------------
// Pago único de créditos
// ---------------------------------------------------------------
async function handleCreditsPurchase(session: Stripe.Checkout.Session, _secret: string) {
  const userId = session.metadata?.userId
  const credits = Number(session.metadata?.credits ?? 0)
  const chargeId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.id

  if (!userId || credits <= 0) {
    console.warn('[stripe-webhook] metadata incompleta en pago', { userId, credits })
    return
  }

  const admin = await getAdminClient()
  const { error } = await admin.rpc('anadir_creditos', {
    p_user_id: userId,
    p_amount: credits,
    p_stripe_charge_id: chargeId,
    p_description: 'Compra Stripe',
  })

  if (error) {
    if (error.code === '23505') {
      console.warn('[stripe-webhook] cargo ya procesado (idempotente)', { chargeId })
    } else {
      console.error('[stripe-webhook] anadir_creditos falló', { error, chargeId })
      throw new Error(error.message)
    }
  }
}

// ---------------------------------------------------------------
// Checkout de suscripción completado
// ---------------------------------------------------------------
async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const planId = session.metadata?.planId
  const credits = Number(session.metadata?.credits ?? 0)

  if (!userId || !planId) {
    console.warn('[stripe-webhook] metadata incompleta en suscripción checkout', { userId, planId })
    return
  }

  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : null
  const customerId =
    typeof session.customer === 'string' ? session.customer : null

  const admin = await getAdminClient()

  // Actualizar plan, customer y subscription en la fila del usuario
  const updates: Record<string, unknown> = {
    plan: planId,
    subscription_status: 'active',
    updated_at: new Date().toISOString(),
  }
  if (subscriptionId) updates.stripe_subscription_id = subscriptionId
  if (customerId) updates.stripe_customer_id = customerId

  await admin.from('users').update(updates).eq('id', userId)

  // Asignar créditos del plan (primer mes)
  if (credits > 0) {
    const chargeId = `sub_checkout_${session.id}`
    const { error } = await admin.rpc('anadir_creditos', {
      p_user_id: userId,
      p_amount: credits,
      p_stripe_charge_id: chargeId,
      p_description: `Suscripción ${planId} — primer mes`,
    })
    if (error && error.code !== '23505') {
      console.error('[stripe-webhook] anadir_creditos falló en suscripción', { error })
    }
  }
}

// ---------------------------------------------------------------
// Suscripción actualizada (cambio de plan, reactivación, etc.)
// ---------------------------------------------------------------
async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId
  if (!userId) return

  const admin = await getAdminClient()

  const status = sub.cancel_at_period_end ? 'canceling' : sub.status
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null

  await admin.from('users').update({
    stripe_subscription_id: sub.id,
    subscription_status: status,
    subscription_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  }).eq('id', userId)
}

// ---------------------------------------------------------------
// Suscripción cancelada / expirada
// ---------------------------------------------------------------
async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId
  if (!userId) return

  const admin = await getAdminClient()

  await admin.from('users').update({
    plan: 'free',
    subscription_status: 'canceled',
    stripe_subscription_id: null,
    subscription_period_end: null,
    updated_at: new Date().toISOString(),
  }).eq('id', userId)
}

// ---------------------------------------------------------------
// Renovación mensual → reponer créditos
// ---------------------------------------------------------------
async function handleSubscriptionRenewal(invoice: Stripe.Invoice, _secret: string) {
  const sub = invoice.subscription
  if (typeof sub !== 'string') return

  const admin = await getAdminClient()

  // Buscar usuario por subscription ID
  const { data: userRow } = await admin
    .from('users')
    .select('id, plan')
    .eq('stripe_subscription_id', sub)
    .maybeSingle()

  if (!userRow) {
    console.warn('[stripe-webhook] usuario no encontrado para renovación', { sub })
    return
  }

  // Créditos según plan
  const PLAN_CREDITS: Record<string, number> = {
    starter: 100,
    builder: 250,
    pro: 500,
  }
  const credits = PLAN_CREDITS[userRow.plan] ?? 0
  if (credits <= 0) return

  const chargeId = `renewal_${invoice.id}`
  const { error } = await admin.rpc('anadir_creditos', {
    p_user_id: userRow.id,
    p_amount: credits,
    p_stripe_charge_id: chargeId,
    p_description: `Renovación ${userRow.plan} — ${new Date().toLocaleDateString('es-ES')}`,
  })

  if (error && error.code !== '23505') {
    console.error('[stripe-webhook] anadir_creditos en renovación falló', { error })
  }
}

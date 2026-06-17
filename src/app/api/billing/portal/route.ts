import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import Stripe from 'stripe'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { getAppUrl } from '@/lib/env'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) throw new ApiError(503, 'Stripe no está configurado')

    const { user, supabase } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'billing-portal'), 5, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const { data: userRow } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!userRow?.stripe_customer_id) {
      throw new ApiError(404, 'No hay datos de facturación asociados a tu cuenta')
    }

    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' })
    const appUrl = getAppUrl()

    const session = await stripe.billingPortal.sessions.create({
      customer: userRow.stripe_customer_id,
      return_url: `${appUrl}/settings?tab=billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    return jsonError(e)
  }
}

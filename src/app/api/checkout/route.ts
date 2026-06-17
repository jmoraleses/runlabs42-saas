import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import Stripe from 'stripe'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { getAppUrl } from '@/lib/env'
import {
  amountEurToCents,
  creditsForEur,
  parsePurchaseAmountEur,
} from '@/lib/stripe/creditPurchase'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) throw new ApiError(503, 'Stripe no está configurado')

    const { user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'checkout'), 10, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const amountEur = parsePurchaseAmountEur(body.amountEur ?? body.amount)
    if (amountEur == null) {
      throw new ApiError(400, 'Importe no válido (mínimo 15 €)')
    }

    const credits = creditsForEur(amountEur)
    const cents = amountEurToCents(amountEur)

    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' })
    const appUrl = getAppUrl()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: cents,
            product_data: {
              name: `Runlabs42 · ${credits} créditos`,
              description: `Recarga de ${amountEur} €`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        credits: String(credits),
        amountEur: String(amountEur),
      },
      success_url: `${appUrl}/settings?tab=billing&success=1`,
      cancel_url: `${appUrl}/settings?tab=billing&canceled=1`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    return jsonError(e)
  }
}

import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import Stripe from 'stripe'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { DEMO_USER, isDemoActiveFromRequest } from '@/lib/auth/demo'
import {
  entriesFromCreditTransactions,
  getDemoSubscriptionHistory,
  listSubscriptionHistoryFromStripe,
} from '@/lib/billing/subscriptionHistory'

export async function GET(request: Request) {
  try {
    if (isDemoActiveFromRequest(request.headers.get('cookie'))) {
      return NextResponse.json({ entries: getDemoSubscriptionHistory() })
    }

    const { user, supabase } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'sub-history'), 20, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    if (user.id === DEMO_USER.id) {
      return NextResponse.json({ entries: getDemoSubscriptionHistory() })
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    const customerId = userRow?.stripe_customer_id ?? null
    const secret = process.env.STRIPE_SECRET_KEY

    if (customerId && secret) {
      const stripe = new Stripe(secret, { apiVersion: '2023-10-16' })
      const entries = await listSubscriptionHistoryFromStripe(stripe, customerId)
      if (entries.length > 0) {
        return NextResponse.json({ entries })
      }
    }

    const { data: txs, error } = await supabase
      .from('transactions')
      .select('id, description, created_at, stripe_charge_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw new ApiError(500, error.message)

    const fallback = entriesFromCreditTransactions(txs ?? [])
    return NextResponse.json({ entries: fallback })
  } catch (e) {
    return jsonError(e)
  }
}

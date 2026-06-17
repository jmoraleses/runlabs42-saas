import type Stripe from 'stripe'
import { getPlanById, type PlanId } from '@/lib/stripe/plans'

export type SubscriptionHistoryKind =
  | 'subscription_start'
  | 'renewal'
  | 'plan_change'
  | 'cancellation'
  | 'payment_failed'

export type SubscriptionHistoryStatus = 'paid' | 'open' | 'void' | 'uncollectible' | 'info'

export type SubscriptionHistoryEntry = {
  id: string
  kind: SubscriptionHistoryKind
  planId: string | null
  planName: string
  amountEur: number | null
  currency: string
  status: SubscriptionHistoryStatus
  createdAt: string
  invoiceUrl?: string | null
}

export function mapBillingReasonToKind(
  reason: string | null | undefined,
): SubscriptionHistoryKind {
  switch (reason) {
    case 'subscription_create':
      return 'subscription_start'
    case 'subscription_cycle':
      return 'renewal'
    case 'subscription_update':
      return 'plan_change'
    default:
      return 'renewal'
  }
}

export function mapInvoiceStatus(
  status: Stripe.Invoice.Status | null | undefined,
): SubscriptionHistoryStatus {
  if (status === 'paid') return 'paid'
  if (status === 'open') return 'open'
  if (status === 'void') return 'void'
  if (status === 'uncollectible') return 'uncollectible'
  return 'info'
}

function resolvePlanFromInvoice(invoice: Stripe.Invoice): {
  planId: string | null
  planName: string
} {
  const subDetails = invoice as Stripe.Invoice & {
    subscription_details?: { metadata?: { planId?: string } }
  }
  const metaPlan =
    subDetails.subscription_details?.metadata?.planId ?? invoice.metadata?.planId
  if (typeof metaPlan === 'string' && metaPlan) {
    const plan = getPlanById(metaPlan)
    if (plan) return { planId: plan.id, planName: plan.name }
    return { planId: metaPlan, planName: metaPlan }
  }

  const line = invoice.lines?.data?.[0]
  const lineMeta = line?.metadata?.planId
  if (typeof lineMeta === 'string' && lineMeta) {
    const plan = getPlanById(lineMeta)
    if (plan) return { planId: plan.id, planName: plan.name }
  }

  const desc = line?.description ?? line?.plan?.nickname ?? null
  if (desc) {
    const matched = (['starter', 'builder', 'pro'] as PlanId[]).find((id) =>
      desc.toLowerCase().includes(id),
    )
    if (matched) {
      const plan = getPlanById(matched)
      return { planId: matched, planName: plan?.name ?? matched }
    }
    return { planId: null, planName: desc }
  }

  return { planId: null, planName: 'Suscripción' }
}

export function invoiceToHistoryEntry(invoice: Stripe.Invoice): SubscriptionHistoryEntry | null {
  if (!invoice.created) return null
  const { planId, planName } = resolvePlanFromInvoice(invoice)
  const currency = (invoice.currency ?? 'eur').toUpperCase()
  const paid = invoice.amount_paid ?? 0

  return {
    id: invoice.id,
    kind: mapBillingReasonToKind(invoice.billing_reason),
    planId,
    planName,
    amountEur: paid > 0 ? paid / 100 : null,
    currency,
    status: mapInvoiceStatus(invoice.status),
    createdAt: new Date(invoice.created * 1000).toISOString(),
    invoiceUrl: invoice.hosted_invoice_url ?? null,
  }
}

export async function listSubscriptionHistoryFromStripe(
  stripe: Stripe,
  customerId: string,
): Promise<SubscriptionHistoryEntry[]> {
  const entries: SubscriptionHistoryEntry[] = []
  const seen = new Set<string>()

  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit: 36,
  })

  for (const inv of invoices.data) {
    const entry = invoiceToHistoryEntry(inv)
    if (!entry || seen.has(entry.id)) continue
    seen.add(entry.id)
    entries.push(entry)
  }

  const { data: subs } = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
  })

  for (const sub of subs) {
    if (!sub.canceled_at) continue
    const id = `cancel_${sub.id}`
    if (seen.has(id)) continue
    seen.add(id)

    const planId = sub.metadata?.planId ?? null
    const plan = planId ? getPlanById(planId) : null

    entries.push({
      id,
      kind: 'cancellation',
      planId,
      planName: plan?.name ?? planId ?? 'Plan',
      amountEur: null,
      currency: 'EUR',
      status: 'info',
      createdAt: new Date(sub.canceled_at * 1000).toISOString(),
    })
  }

  entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  return entries
}

/** Historial local a partir de transacciones con descripción de suscripción/renovación. */
export function entriesFromCreditTransactions(
  rows: { id: string; description: string | null; created_at: string; stripe_charge_id: string | null }[],
): SubscriptionHistoryEntry[] {
  const subPattern = /suscripción|renovación|subscription/i
  return rows
    .filter((r) => subPattern.test(r.description ?? ''))
    .map((r) => {
      const desc = r.description ?? ''
      const planMatch = desc.match(/(starter|builder|pro)/i)
      const planId = planMatch?.[1]?.toLowerCase() ?? null
      const plan = planId ? getPlanById(planId) : null
      const isStart = /primer mes|alta|create/i.test(desc)
      const isRenewal = /renovación|renewal|cycle/i.test(desc)

      return {
        id: r.stripe_charge_id ?? r.id,
        kind: isStart
          ? 'subscription_start'
          : isRenewal
            ? 'renewal'
            : 'renewal',
        planId,
        planName: plan?.name ?? planId ?? 'Suscripción',
        amountEur: null,
        currency: 'EUR',
        status: 'paid' as const,
        createdAt: r.created_at,
      }
    })
}

export function getDemoSubscriptionHistory(): SubscriptionHistoryEntry[] {
  const now = Date.now()
  const month = 30 * 24 * 60 * 60 * 1000
  const entries: SubscriptionHistoryEntry[] = [
    {
      id: 'demo-renewal-recent',
      kind: 'renewal',
      planId: 'starter',
      planName: 'Starter',
      amountEur: 19,
      currency: 'EUR',
      status: 'paid',
      createdAt: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-renewal-2',
      kind: 'renewal',
      planId: 'starter',
      planName: 'Starter',
      amountEur: 19,
      currency: 'EUR',
      status: 'paid',
      createdAt: new Date(now - month).toISOString(),
    },
    {
      id: 'demo-renewal-1',
      kind: 'renewal',
      planId: 'starter',
      planName: 'Starter',
      amountEur: 19,
      currency: 'EUR',
      status: 'paid',
      createdAt: new Date(now - month * 2).toISOString(),
    },
    {
      id: 'demo-plan-change-builder',
      kind: 'plan_change',
      planId: 'builder',
      planName: 'Builder',
      amountEur: 49,
      currency: 'EUR',
      status: 'paid',
      createdAt: new Date(now - month * 4).toISOString(),
    },
    {
      id: 'demo-start-1',
      kind: 'subscription_start',
      planId: 'starter',
      planName: 'Starter',
      amountEur: 19,
      currency: 'EUR',
      status: 'paid',
      createdAt: new Date(now - month * 5).toISOString(),
    },
  ]
  entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  return entries
}

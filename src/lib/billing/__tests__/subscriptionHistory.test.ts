import { describe, expect, it } from 'vitest'
import {
  entriesFromCreditTransactions,
  mapBillingReasonToKind,
  mapInvoiceStatus,
} from '@/lib/billing/subscriptionHistory'

describe('subscriptionHistory', () => {
  it('maps billing reasons', () => {
    expect(mapBillingReasonToKind('subscription_create')).toBe('subscription_start')
    expect(mapBillingReasonToKind('subscription_cycle')).toBe('renewal')
    expect(mapBillingReasonToKind('subscription_update')).toBe('plan_change')
  })

  it('maps invoice status', () => {
    expect(mapInvoiceStatus('paid')).toBe('paid')
    expect(mapInvoiceStatus('open')).toBe('open')
  })

  it('builds entries from subscription transactions', () => {
    const rows = entriesFromCreditTransactions([
      {
        id: '1',
        description: 'Suscripción starter — primer mes',
        created_at: '2026-01-01T00:00:00Z',
        stripe_charge_id: 'sub_checkout_x',
      },
      {
        id: '2',
        description: 'Renovación builder — 1/2/2026',
        created_at: '2026-02-01T00:00:00Z',
        stripe_charge_id: 'renewal_y',
      },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.kind).toBe('subscription_start')
    expect(rows[0]?.planId).toBe('starter')
    expect(rows[1]?.planId).toBe('builder')
  })
})

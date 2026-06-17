import { describe, expect, it } from 'vitest'
import { hasPaidSubscription } from '@/lib/pricing/subscription'

describe('hasPaidSubscription', () => {
  it('returns false for free and demo', () => {
    expect(hasPaidSubscription('free')).toBe(false)
    expect(hasPaidSubscription('demo')).toBe(false)
    expect(hasPaidSubscription(null)).toBe(false)
  })

  it('returns true for paid tiers', () => {
    expect(hasPaidSubscription('starter')).toBe(true)
    expect(hasPaidSubscription('pro')).toBe(true)
  })
})

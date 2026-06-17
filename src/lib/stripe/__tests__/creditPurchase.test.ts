import { describe, expect, it } from 'vitest'
import { creditsForEur } from '@/lib/stripe/creditPurchase'

describe('creditsForEur', () => {
  it('maps fixed packs 15/40/80 EUR', () => {
    expect(creditsForEur(15)).toBe(100)
    expect(creditsForEur(40)).toBe(250)
    expect(creditsForEur(80)).toBe(500)
  })

  it('uses 6.25 cr/€ for non-pack amounts', () => {
    expect(creditsForEur(32)).toBe(200)
  })
})

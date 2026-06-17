import { describe, expect, it } from 'vitest'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    const key = `test-allow-${Date.now()}`
    const first = rateLimit(key, 3, 60_000)
    const second = rateLimit(key, 3, 60_000)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(second.remaining).toBe(1)
  })

  it('blocks when limit is exceeded', () => {
    const key = `test-block-${Date.now()}`
    rateLimit(key, 2, 60_000)
    rateLimit(key, 2, 60_000)
    const blocked = rateLimit(key, 2, 60_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('builds stable keys from user, ip, and route', () => {
    expect(rateLimitKey('u1', '1.2.3.4', 'stream')).toBe('stream:u1:1.2.3.4')
    expect(rateLimitKey(null, null, 'health')).toBe('health:anon:unknown')
  })
})

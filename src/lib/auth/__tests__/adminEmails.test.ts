import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMO_USER_EMAIL } from '@/lib/auth/demo-server'
import { getAdminEmails, isAdminEmail } from '@/lib/auth/adminEmails'

describe('adminEmails', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes demo email only in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(getAdminEmails()).toContain(DEMO_USER_EMAIL)

    vi.stubEnv('NODE_ENV', 'production')
    expect(getAdminEmails()).not.toContain(DEMO_USER_EMAIL)
  })

  it('isAdminEmail respects environment', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isAdminEmail(DEMO_USER_EMAIL)).toBe(true)

    vi.stubEnv('NODE_ENV', 'production')
    expect(isAdminEmail(DEMO_USER_EMAIL)).toBe(false)
  })

  it('honors ADMIN_EMAILS env override', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_EMAILS', 'custom@example.com')
    expect(getAdminEmails()).toEqual(['custom@example.com'])
    expect(isAdminEmail('custom@example.com')).toBe(true)
  })
})

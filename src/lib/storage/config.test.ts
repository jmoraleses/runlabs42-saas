import { describe, expect, it } from 'vitest'
import { userStorageLimitBytes } from './config'

describe('userStorageLimitBytes', () => {
  it('defaults to 100 MB', () => {
    const prev = process.env.USER_STORAGE_LIMIT_MB
    delete process.env.USER_STORAGE_LIMIT_MB
    expect(userStorageLimitBytes()).toBe(100 * 1024 * 1024)
    if (prev) process.env.USER_STORAGE_LIMIT_MB = prev
  })

  it('reads env override', () => {
    process.env.USER_STORAGE_LIMIT_MB = '50'
    expect(userStorageLimitBytes()).toBe(50 * 1024 * 1024)
    delete process.env.USER_STORAGE_LIMIT_MB
  })
})

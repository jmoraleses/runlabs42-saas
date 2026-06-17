import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeClipboardImageFile, isLocalChatImageStorage } from '@/lib/chat/imageAttachments'

describe('isLocalChatImageStorage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is true in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isLocalChatImageStorage()).toBe(true)
  })

  it('is false in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isLocalChatImageStorage()).toBe(false)
  })
})

describe('normalizeClipboardImageFile', () => {
  it('assigns png type and name when clipboard file is bare', () => {
    const raw = new File([new Uint8Array([1, 2, 3])], '', { type: '' })
    const normalized = normalizeClipboardImageFile(raw)
    expect(normalized.type).toBe('image/png')
    expect(normalized.name).toMatch(/^capture-\d+\.png$/)
  })
})

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  setPendingEditorSession,
  peekPendingEditorSession,
  clearPendingEditorSession,
} from '@/lib/landing/pendingEditorPrompt'

function installSessionStorageMock() {
  const store = new Map<string, string>()
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
  }
  vi.stubGlobal('window', { sessionStorage: mock })
  vi.stubGlobal('sessionStorage', mock)
  return () => {
    vi.unstubAllGlobals()
  }
}

describe('pendingEditorSession brief', () => {
  let teardown: (() => void) | undefined

  beforeEach(() => {
    teardown = installSessionStorageMock()
    clearPendingEditorSession()
  })

  afterEach(() => {
    clearPendingEditorSession()
    teardown?.()
  })

  it('round-trips brief in sessionStorage', () => {
    setPendingEditorSession({
      text: 'Tienda de moda',
      images: [],
      useSpecKit: false,
      brief: { siteType: 'ecommerce', brandTone: 'premium' },
    })
    const pending = peekPendingEditorSession()
    expect(pending?.brief?.siteType).toBe('ecommerce')
    expect(pending?.brief?.brandTone).toBe('premium')
  })
})

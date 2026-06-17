import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumeStudioForceNewProject,
  consumeStudioReplaceDesign,
} from '@/lib/projects/openStudio'

function mockSessionStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
    },
  })
  return store
}

describe('openStudio session flags', () => {
  beforeEach(() => {
    mockSessionStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('consumeStudioForceNewProject solo devuelve true una vez', () => {
    window.sessionStorage.setItem('sk.studio.forceNewProject', '1')
    expect(consumeStudioForceNewProject()).toBe(true)
    expect(consumeStudioForceNewProject()).toBe(false)
  })

  it('consumeStudioReplaceDesign solo devuelve true una vez', () => {
    window.sessionStorage.setItem('sk.studio.replaceDesign', '1')
    expect(consumeStudioReplaceDesign()).toBe(true)
    expect(consumeStudioReplaceDesign()).toBe(false)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadWorkspaceSnapshot,
  pruneWorkspaceSnapshots,
  saveWorkspaceSnapshot,
} from '@/lib/chat/workspaceSnapshots'

function mockBrowserStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  })
}

describe('workspaceSnapshots', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    mockBrowserStorage()
  })

  it('saves and loads a snapshot', () => {
    const id = saveWorkspaceSnapshot('proj-1', {
      files: [{ path: 'src/App.tsx', content: 'export default function App() {}' }],
      spec: '# Spec',
    })
    expect(id).toBeTruthy()
    const loaded = loadWorkspaceSnapshot('proj-1', id!)
    expect(loaded?.files).toHaveLength(1)
    expect(loaded?.spec).toBe('# Spec')
  })

  it('prunes snapshots by id', () => {
    const a = saveWorkspaceSnapshot('proj-1', { files: [], spec: '' })
    const b = saveWorkspaceSnapshot('proj-1', { files: [], spec: 'b' })
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    pruneWorkspaceSnapshots('proj-1', [a!])
    expect(loadWorkspaceSnapshot('proj-1', a!)).toBeNull()
    expect(loadWorkspaceSnapshot('proj-1', b!)?.spec).toBe('b')
  })

  it('returns null when storage quota is exceeded', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          const err = new Error('Quota exceeded')
          ;(err as Error & { name: string }).name = 'QuotaExceededError'
          throw err
        },
        removeItem: () => undefined,
      },
    })

    const id = saveWorkspaceSnapshot('proj-1', { files: [], spec: '' })
    expect(id).toBeNull()
  })
})

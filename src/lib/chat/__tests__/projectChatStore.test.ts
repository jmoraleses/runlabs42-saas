import { describe, expect, it, beforeEach } from 'vitest'
import {
  loadProjectChatSessions,
  saveProjectChatSessions,
  removeProjectChatSessions,
} from '@/lib/chat/projectChatStore'

describe('projectChatStore', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    const mock = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    }
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: mock },
      configurable: true,
    })
  })

  it('truncates long assistant messages on save', () => {
    const huge = 'x'.repeat(20_000)
    const ok = saveProjectChatSessions('p1', [
      {
        id: 's1',
        projectId: 'p1',
        title: 'Test',
        messages: [{ role: 'assistant', content: huge }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    expect(ok).toBe(true)
    const loaded = loadProjectChatSessions('p1')
    expect(loaded[0]?.messages[0]?.content.length).toBeLessThan(15_000)
    expect(loaded[0]?.messages[0]?.content).toContain('recortado')
  })

  it('returns false when storage throws quota on setItem', () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: () => {
          const err = new DOMException('quota', 'QuotaExceededError')
          throw err
        },
        removeItem: (k: string) => store.delete(k),
      },
      configurable: true,
    })
    const ok = saveProjectChatSessions('p2', [
      {
        id: 's1',
        projectId: 'p2',
        title: 'T',
        messages: [{ role: 'user', content: 'hola' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    expect(ok).toBe(false)
    expect(loadProjectChatSessions('p2')).toEqual([])
  })

  it('removeProjectChatSessions clears project bucket', () => {
    saveProjectChatSessions('p1', [
      {
        id: 's1',
        projectId: 'p1',
        title: 'T',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    removeProjectChatSessions('p1')
    expect(loadProjectChatSessions('p1')).toEqual([])
  })
})

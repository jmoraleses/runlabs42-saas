import fs from 'fs/promises'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = 'demo-test-files-store'

describe('DemoProjectFilesStore', () => {
  afterEach(async () => {
    const dir = path.join(
      process.cwd(),
      '.data',
      'local-projects',
      PROJECT_ID.replace(/[^a-zA-Z0-9._-]/g, '_'),
    )
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('persists files on disk when NODE_ENV is development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { getDemoProjectFilesStore } = await import('../demoProjectFilesStore')
    const store = getDemoProjectFilesStore(PROJECT_ID)
    await store.put('hello.txt', 'hola')
    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.path).toBe('hello.txt')
    expect(list[0]?.content).toBe('hola')
    vi.unstubAllEnvs()
  })

  it('putMany writes manifest once under concurrent-style batch', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { getDemoProjectFilesStore } = await import('../demoProjectFilesStore')
    const store = getDemoProjectFilesStore(PROJECT_ID)
    await store.putMany([
      { path: 'index.html', content: '<html></html>' },
      { path: 'src/main.tsx', content: 'export {}' },
      { path: 'src/App.tsx', content: 'export default function App() { return null }' },
    ])
    const list = await store.list()
    expect(list.map((f) => f.path).sort()).toEqual([
      'index.html',
      'src/App.tsx',
      'src/main.tsx',
    ])
    vi.unstubAllEnvs()
  })
})

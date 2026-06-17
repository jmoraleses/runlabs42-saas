import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDemoProject,
  DEMO_STORAGE_KEY,
  loadDemoProjects,
} from '@/lib/auth/demo'
import {
  pruneEmptyStudioProject,
  workspaceHasMeaningfulContent,
} from '@/lib/projects/studioCommit'

const apiFetch = vi.fn()

vi.mock('@/lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}))

function mockBrowserStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
    dispatchEvent: vi.fn(),
  })
  vi.stubGlobal('document', { cookie: '' })
  return store
}

describe('workspaceHasMeaningfulContent', () => {
  it('returns false for empty workspace', () => {
    expect(workspaceHasMeaningfulContent({})).toBe(false)
  })

  it('returns true when a file has non-whitespace content', () => {
    expect(
      workspaceHasMeaningfulContent({
        'src/App.tsx': { content: 'export default function App() {}', dirty: true, language: 'typescript' },
      }),
    ).toBe(true)
  })

  it('returns true when spec has text', () => {
    expect(workspaceHasMeaningfulContent({}, null, '# Spec')).toBe(true)
  })
})

describe('pruneEmptyStudioProject', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    mockBrowserStorage()
    window.localStorage.setItem(DEMO_STORAGE_KEY, '1')
  })

  it('removes demo project with no files and no spec', async () => {
    apiFetch.mockResolvedValueOnce({ files: [] })
    const project = createDemoProject('Vacío')
    expect(loadDemoProjects()).toHaveLength(1)
    await pruneEmptyStudioProject(project.id)
    expect(loadDemoProjects()).toEqual([])
  })

  it('keeps demo project that has files', async () => {
    apiFetch.mockResolvedValueOnce({ files: [{ path: 'a.ts' }] })
    const project = createDemoProject('Con archivos')
    await pruneEmptyStudioProject(project.id)
    expect(loadDemoProjects()).toHaveLength(1)
  })
})

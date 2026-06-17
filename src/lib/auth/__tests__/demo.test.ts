import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEMO_PROJECTS_STORAGE_KEY,
  DEMO_STORAGE_KEY,
  createDemoProject,
  demoEditorPath,
  getOrCreateDefaultDemoProject,
  loadDemoProjects,
  removeDemoProject,
  updateDemoProject,
} from '@/lib/auth/demo'
import {
  addDemoMarketplaceProduct,
  ensureDemoSeedData,
  loadDemoMarketplaceProducts,
  resolveDemoMarketplaceCovers,
  SEED_PROJECT_IDS,
} from '@/lib/auth/demo-seed'

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

describe('demoEditorPath', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    mockBrowserStorage()
    window.localStorage.setItem(DEMO_STORAGE_KEY, '1')
  })

  it('does not create a project when the list is empty', () => {
    expect(demoEditorPath()).toBe('/studio')
    expect(loadDemoProjects()).toEqual([])
  })

  it('uses an existing project without creating another', () => {
    const project = createDemoProject('Mi app')
    expect(demoEditorPath()).toBe(`/studio?project=${encodeURIComponent(project.id)}`)
    expect(loadDemoProjects()).toHaveLength(1)
  })

  it('getOrCreateDefaultDemoProject still creates on explicit use', () => {
    const project = getOrCreateDefaultDemoProject()
    expect(project.name).toBe('Proyecto demo')
    expect(loadDemoProjects()).toHaveLength(1)
  })

  it('removeDemoProject clears the last project', () => {
    const project = createDemoProject('Único')
    removeDemoProject(project.id)
    expect(loadDemoProjects()).toEqual([])
    expect(demoEditorPath()).toBe('/studio')
    expect(window.localStorage.getItem(DEMO_PROJECTS_STORAGE_KEY)).toBe('[]')
  })
})

describe('ensureDemoSeedData', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    mockBrowserStorage()
    window.localStorage.setItem(DEMO_STORAGE_KEY, '1')
  })

  it('creates two sample projects and marketplace listings', () => {
    ensureDemoSeedData()
    const projects = loadDemoProjects()
    expect(projects.map((p) => p.id)).toEqual(
      expect.arrayContaining([SEED_PROJECT_IDS.saas, SEED_PROJECT_IDS.dashboard]),
    )
    expect(projects.find((p) => p.id === SEED_PROJECT_IDS.saas)?.deployedUrl).toBeTruthy()
    const mp = loadDemoMarketplaceProducts()
    expect(mp.length).toBeGreaterThanOrEqual(4)
    expect(mp.some((p) => p.author === 'Usuario Demo')).toBe(true)
  })
})

describe('resolveDemoMarketplaceCovers', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    mockBrowserStorage()
    window.localStorage.setItem(DEMO_STORAGE_KEY, '1')
  })

  it('reads cover from linked demo project when listing has no preview', () => {
    const project = createDemoProject('Con portada')
    const coverUrl = 'data:image/png;base64,thumb'
    updateDemoProject(project.id, { coverUrl, coverImages: [coverUrl] })
    addDemoMarketplaceProduct({
      id: 'demo-user-test',
      name: 'Test',
      author: '@demo',
      desc: '',
      price: 0,
      stars: 0,
      rating: 0,
      framework: 'react',
      category: 'general',
      demoProjectId: project.id,
      previewUrl: null,
      coverImages: null,
    })
    const stored = loadDemoMarketplaceProducts().find((p) => p.id === 'demo-user-test')!
    expect(stored.previewUrl).toBeNull()
    const resolved = resolveDemoMarketplaceCovers(stored)
    expect(resolved.previewUrl).toBe(coverUrl)
    expect(resolved.coverImages).toEqual([coverUrl])
  })
})

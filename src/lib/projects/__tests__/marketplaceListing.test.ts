import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Project } from '@/types'

vi.mock('@/lib/auth/demo', () => ({
  isDemoActive: vi.fn(() => false),
}))

vi.mock('@/lib/auth/demo-seed', () => ({
  loadDemoMarketplaceProducts: vi.fn(() => []),
}))

import { isDemoActive } from '@/lib/auth/demo'
import { loadDemoMarketplaceProducts } from '@/lib/auth/demo-seed'
import { isProjectMarketplaceListed } from '@/lib/projects/marketplaceListing'

const baseProject: Project = {
  id: 'proj-1',
  userId: 'user-1',
  name: 'Test',
  description: null,
  framework: 'react',
  status: 'draft',
  public: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('isProjectMarketplaceListed', () => {
  beforeEach(() => {
    vi.mocked(isDemoActive).mockReturnValue(false)
    vi.mocked(loadDemoMarketplaceProducts).mockReturnValue([])
  })

  it('returns false when project is null', () => {
    expect(isProjectMarketplaceListed(null)).toBe(false)
  })

  it('returns true when marketplaceListed is set', () => {
    expect(isProjectMarketplaceListed({ ...baseProject, marketplaceListed: true })).toBe(true)
  })

  it('checks demo marketplace products by demoProjectId', () => {
    vi.mocked(isDemoActive).mockReturnValue(true)
    vi.mocked(loadDemoMarketplaceProducts).mockReturnValue([
      {
        id: 'mp-1',
        name: 'Listed',
        author: '@demo',
        desc: '',
        price: 0,
        stars: 0,
        rating: 0,
        framework: 'react',
        category: 'general',
        demoProjectId: 'proj-1',
      },
    ])
    expect(isProjectMarketplaceListed(baseProject)).toBe(true)
  })
})

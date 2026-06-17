import { describe, expect, it } from 'vitest'
import { normalizeProject, normalizeProjects } from '@/lib/api/projects'

describe('normalizeProject', () => {
  it('maps snake_case API rows', () => {
    const p = normalizeProject({
      id: 'abc',
      user_id: 'u1',
      name: 'Demo',
      framework: 'next',
      status: 'draft',
      public: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    })
    expect(p).toMatchObject({
      id: 'abc',
      userId: 'u1',
      name: 'Demo',
      framework: 'next',
    })
  })

  it('maps camelCase API payloads', () => {
    const p = normalizeProject({
      id: '1',
      userId: 'u1',
      name: 'Web',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    })
    expect(p?.userId).toBe('u1')
    expect(p?.name).toBe('Web')
  })

  it('returns null for invalid rows', () => {
    expect(normalizeProject(null)).toBeNull()
    expect(normalizeProject({ name: 'x' })).toBeNull()
    expect(normalizeProject({ id: '', name: 'x' })).toBeNull()
    expect(normalizeProjects('not-array')).toEqual([])
  })

  it('filters invalid items in list', () => {
    const list = normalizeProjects([
      { id: '1', user_id: 'u', name: 'A', created_at: 'x', updated_at: 'x' },
      { bad: true },
    ])
    expect(list).toHaveLength(1)
  })
})

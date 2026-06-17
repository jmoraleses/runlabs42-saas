import { describe, expect, it } from 'vitest'
import { mergeDesignPages, PAGE_GAP } from '@/lib/design/pages'
import type { DesignPageMeta } from '@/lib/design/types'

const home: DesignPageMeta = {
  id: 'home',
  name: 'Inicio',
  path: 'design/pages/home/index.html',
  x: 0,
  y: 0,
  width: 390,
  height: 844,
}

const about: DesignPageMeta = {
  id: 'about',
  name: 'About',
  path: 'design/pages/about/index.html',
  x: 500,
  y: 0,
  width: 390,
  height: 844,
}

describe('mergeDesignPages', () => {
  it('appends new pages to the right of existing layout', () => {
    const shop: DesignPageMeta = {
      id: 'shop',
      name: 'Tienda',
      path: 'design/pages/shop/index.html',
      width: 390,
      height: 844,
    }
    const merged = mergeDesignPages([home, about], [shop])
    expect(merged.map((p) => p.id)).toEqual(['home', 'about', 'shop'])
    expect(merged[2]?.x).toBe(500 + 390 + PAGE_GAP)
    expect(merged[2]?.y).toBe(0)
  })

  it('preserves position when updating an existing page id', () => {
    const updatedHome = { ...home, name: 'Inicio renovado' }
    const merged = mergeDesignPages([home, about], [updatedHome])
    expect(merged).toHaveLength(2)
    expect(merged[0]?.name).toBe('Inicio renovado')
    expect(merged[0]?.x).toBe(0)
    expect(merged[0]?.y).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { parseRegionsFromModelText } from '@/lib/design/mockupRegionsParse'

describe('parseRegionsFromModelText', () => {
  it('ignora regiones con h o w en cero', () => {
    const regions = parseRegionsFromModelText(`{
      "regions": [
        { "id": "header", "label": "Header", "x": 0.1, "y": 0.1, "w": 0.8, "h": 0 },
        { "id": "hero", "label": "Hero", "x": 0.1, "y": 0.2, "w": 0.8, "h": 0.3 }
      ]
    }`)
    expect(regions).toHaveLength(1)
    expect(regions[0]?.id).toBe('hero')
  })

  it('extrae regiones completas de JSON truncado', () => {
    const regions = parseRegionsFromModelText(`{
      "regions": [
        { "id": "nav", "label": "Navigation", "x": 0, "y": 0, "w": 1, "h": 0.08 },
        { "id": "hero", "label": "Hero", "x": 0.1, "y": 0.12, "w": 0.8, "h": 0.35 },
        { "id": "footer", "label": "Footer", "x": 0, "y": 0.9, "w": 1, "h": 0
    `)
    expect(regions.length).toBeGreaterThanOrEqual(2)
    expect(regions.some((r) => r.id === 'nav')).toBe(true)
    expect(regions.some((r) => r.id === 'hero')).toBe(true)
  })
})

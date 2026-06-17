import { describe, expect, it } from 'vitest'
import { normalizePinAreaFromDrag, pinAreaWithDefaults } from '@/lib/visual-edit/canvasPinArea'

describe('normalizePinAreaFromDrag', () => {
  it('creates default square on click without drag', () => {
    const area = normalizePinAreaFromDrag({ x: 50, y: 40 }, { x: 50, y: 40 })
    expect(area.widthPercent).toBeGreaterThanOrEqual(4)
    expect(area.heightPercent).toBeGreaterThanOrEqual(4)
    expect(area.xPercent).toBeLessThan(50)
    expect(area.yPercent).toBeLessThan(40)
  })

  it('uses dragged rectangle', () => {
    const area = normalizePinAreaFromDrag({ x: 10, y: 20 }, { x: 40, y: 50 })
    expect(area.xPercent).toBe(10)
    expect(area.yPercent).toBe(20)
    expect(area.widthPercent).toBe(30)
    expect(area.heightPercent).toBe(30)
  })
})

describe('pinAreaWithDefaults', () => {
  it('fills missing dimensions for legacy pins', () => {
    const area = pinAreaWithDefaults({ xPercent: 5, yPercent: 10 })
    expect(area.widthPercent).toBeGreaterThan(0)
    expect(area.heightPercent).toBeGreaterThan(0)
  })
})


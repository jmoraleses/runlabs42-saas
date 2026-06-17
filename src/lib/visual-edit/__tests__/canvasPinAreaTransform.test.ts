import { describe, it, expect } from 'vitest'
import {
  applyPinAreaMove,
  applyPinAreaResize,
  clampPinArea,
} from '@/lib/visual-edit/canvasPinArea'

describe('canvasPinArea transform', () => {
  const base = { xPercent: 20, yPercent: 30, widthPercent: 40, heightPercent: 25 }

  it('moves area within bounds', () => {
    const next = applyPinAreaMove(base, 10, 5)
    expect(next.xPercent).toBe(30)
    expect(next.yPercent).toBe(35)
    expect(next.widthPercent).toBe(40)
    expect(next.heightPercent).toBe(25)
  })

  it('clamps move so rect stays inside canvas', () => {
    const next = applyPinAreaMove(base, 80, 80)
    expect(next.xPercent).toBe(60)
    expect(next.yPercent).toBe(75)
  })

  it('resizes from south-east handle', () => {
    const next = applyPinAreaResize(base, 'se', { x: 70, y: 65 })
    expect(next).toEqual(
      clampPinArea({
        xPercent: 20,
        yPercent: 30,
        widthPercent: 50,
        heightPercent: 35,
      }),
    )
  })

  it('resizes from north-west handle', () => {
    const next = applyPinAreaResize(base, 'nw', { x: 10, y: 15 })
    expect(next.xPercent).toBe(10)
    expect(next.yPercent).toBe(15)
    expect(next.widthPercent).toBe(50)
    expect(next.heightPercent).toBe(40)
  })
})

import { describe, expect, it } from 'vitest'
import { aspectRatioFromPageDimensions } from '@/lib/ai/constants'

describe('aspectRatioFromPageDimensions', () => {
  it('usa 9:16 para páginas desktop altas (página completa)', () => {
    expect(aspectRatioFromPageDimensions(1280, 2400)).toBe('9:16')
  })

  it('usa 9:16 para móvil', () => {
    expect(aspectRatioFromPageDimensions(390, 844)).toBe('9:16')
  })

  it('usa 3:4 para tablet', () => {
    expect(aspectRatioFromPageDimensions(768, 1024)).toBe('3:4')
  })
})

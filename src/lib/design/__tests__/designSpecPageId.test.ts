import { describe, expect, it } from 'vitest'
import { canvasPrimaryPageId, designSpecPageId } from '@/lib/design/types'

describe('designSpecPageId', () => {
  it('maps mockup companion frames to the primary page id', () => {
    expect(designSpecPageId('home--mockup')).toBe('home')
    expect(canvasPrimaryPageId('home--mockup')).toBe('home')
  })

  it('maps alt mockup variants to the canonical spec page id', () => {
    expect(designSpecPageId('catalog-alt-2')).toBe('catalog')
  })
})

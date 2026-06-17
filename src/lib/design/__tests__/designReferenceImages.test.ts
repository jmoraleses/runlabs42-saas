import { describe, expect, it } from 'vitest'
import {
  DESIGN_REFERENCE_MAX_INLINE_BASE64,
  isResolvableDesignImagePayload,
} from '@/lib/design/designReferenceImages.client'

describe('designReferenceImages', () => {
  it('acepta url o base64 suficiente', () => {
    expect(isResolvableDesignImagePayload({ mimeType: 'image/png', url: '/api/x' })).toBe(true)
    expect(
      isResolvableDesignImagePayload({
        mimeType: 'image/png',
        data: 'a'.repeat(100),
      }),
    ).toBe(true)
    expect(isResolvableDesignImagePayload({ mimeType: 'image/png', data: 'short' })).toBe(false)
    expect(isResolvableDesignImagePayload({ mimeType: 'image/png' })).toBe(false)
  })

  it('umbral inline acorde al límite del POST', () => {
    expect(DESIGN_REFERENCE_MAX_INLINE_BASE64).toBeGreaterThan(500_000)
    expect(DESIGN_REFERENCE_MAX_INLINE_BASE64).toBeLessThan(2_000_000)
  })
})

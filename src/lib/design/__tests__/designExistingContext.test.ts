import { describe, expect, it } from 'vitest'
import {
  allocateNewDesignPageId,
  newPageNameFromPrompt,
} from '@/lib/design/designExistingContext'
import type { DesignPageMeta } from '@/lib/design/types'

describe('designExistingContext', () => {
  it('allocateNewDesignPageId evita colisiones', () => {
    const existing: DesignPageMeta[] = [
      { id: 'screen-abc', name: 'A', path: 'design/pages/screen-abc/index.html' },
    ]
    const id = allocateNewDesignPageId(existing)
    expect(id).not.toBe('screen-abc')
    expect(id).toMatch(/^screen-/)
  })

  it('newPageNameFromPrompt recorta el prompt', () => {
    expect(newPageNameFromPrompt('  Tienda de cactus premium  ')).toBe(
      'Tienda de cactus premium',
    )
    expect(newPageNameFromPrompt('  ')).toBe('Nueva pantalla')
  })
})

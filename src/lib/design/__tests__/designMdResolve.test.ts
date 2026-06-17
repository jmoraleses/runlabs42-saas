import { describe, expect, it } from 'vitest'
import { resolveDesignMdFromModel } from '@/lib/design/designMd'

describe('resolveDesignMdFromModel skipBriefFallback', () => {
  it('no aplica plantilla del brief cuando skipBriefFallback', () => {
    const resolved = resolveDesignMdFromModel('texto sin yaml', { prompt: 'landing morada' }, {
      skipBriefFallback: true,
    })
    expect(resolved.source).not.toBe('brief-fallback')
    expect(resolved.designMd).toContain('texto sin yaml')
  })
})

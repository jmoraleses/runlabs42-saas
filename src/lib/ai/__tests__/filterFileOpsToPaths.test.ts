import { describe, expect, it } from 'vitest'
import { filterFileOpsToPaths } from '@/lib/ai/filterFileOpsToPaths'

describe('filterFileOpsToPaths', () => {
  it('keeps only allowed paths', () => {
    const ops = filterFileOpsToPaths(
      [
        { type: 'update', path: 'src/App.tsx', content: 'a' },
        { type: 'update', path: 'src/main.tsx', content: 'b' },
      ],
      ['src/App.tsx'],
    )
    expect(ops).toHaveLength(1)
    expect(ops[0]?.path).toBe('src/App.tsx')
  })
})

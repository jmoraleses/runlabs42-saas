import { describe, expect, it } from 'vitest'
import { resolveStreamDefaultPath } from '@/lib/projects/resolveStreamDefaultPath'

describe('resolveStreamDefaultPath', () => {
  it('prefers src/App.tsx over vite.config.ts as active file', () => {
    expect(
      resolveStreamDefaultPath('vite.config.ts', [
        'vite.config.ts',
        'src/App.tsx',
        'src/main.tsx',
      ]),
    ).toBe('src/App.tsx')
  })

  it('keeps src/App.tsx as default even if another tsx file is active', () => {
    expect(
      resolveStreamDefaultPath('src/components/Form.tsx', [
        'src/App.tsx',
        'src/components/Form.tsx',
      ]),
    ).toBe('src/App.tsx')
  })

  it('falls back to src/App.tsx when workspace is empty', () => {
    expect(resolveStreamDefaultPath('vite.config.ts', [])).toBe('src/App.tsx')
  })
})

import { describe, expect, it } from 'vitest'
import { persistedDesignCanvasPaths } from '@/lib/design/pages'

describe('persistedDesignCanvasPaths', () => {
  it('no incluye HTML del spec si el archivo aún no está en accumulated', () => {
    const paths = persistedDesignCanvasPaths([
      'spec/design.json',
      'design/tokens.json',
      'design/layout.json',
    ])
    expect(paths).not.toContain('design/site/index.html')
  })

  it('incluye HTML cuando ya fue persistido', () => {
    const paths = persistedDesignCanvasPaths([
      'spec/design.json',
      'design/site/index.html',
    ])
    expect(paths).toContain('design/site/index.html')
  })
})

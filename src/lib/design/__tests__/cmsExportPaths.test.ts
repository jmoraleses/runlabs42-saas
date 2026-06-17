import { describe, expect, it } from 'vitest'
import {
  enrichCmsExportFromDesign,
  normalizeCmsExportPaths,
} from '@/lib/design/cmsExportPaths'

describe('cmsExportPaths', () => {
  it('prefixes shopify paths emitted without export/', () => {
    const out = normalizeCmsExportPaths(
      [
        { path: 'layout/theme.liquid', content: '<html></html>' },
        { path: 'sections/header.liquid', content: '<header></header>' },
      ],
      'shopify',
    )
    expect(out.map((f) => f.path)).toEqual([
      'export/shopify/theme/layout/theme.liquid',
      'export/shopify/theme/sections/header.liquid',
    ])
  })

  it('copies design theme css into shopify assets', () => {
    const out = enrichCmsExportFromDesign(
      [{ path: 'export/shopify/theme/layout/theme.liquid', content: '' }],
      'shopify',
      [{ path: 'design/system/theme.css', content: ':root { --c: red; }' }],
      'Demo',
    )
    expect(out.some((f) => f.path === 'export/shopify/theme/assets/theme.css')).toBe(true)
    expect(out.find((f) => f.path.endsWith('theme.css'))?.content).toContain('--c: red')
  })
})

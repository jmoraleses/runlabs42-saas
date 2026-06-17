import { describe, expect, it } from 'vitest'
import { normalizePathsForDownload } from '@/lib/projects/downloadProjectZip'

describe('normalizePathsForDownload', () => {
  it('organizes shopify files under export theme path', () => {
    const out = normalizePathsForDownload(
      [
        { path: 'layout/theme.liquid', content: '<html />' },
        { path: 'sections/hero.liquid', content: '<section />' },
        { path: 'preview/index.html', content: '<!doctype html>' },
      ],
      'shopify',
    )
    expect(out.map((f) => f.path)).toEqual(
      expect.arrayContaining([
        'export/shopify/theme/layout/theme.liquid',
        'export/shopify/theme/sections/hero.liquid',
        'preview/index.html',
      ]),
    )
  })

  it('keeps design and spec paths untouched', () => {
    const out = normalizePathsForDownload(
      [
        { path: 'design/site/index.html', content: '<html />' },
        { path: 'spec/design.md', content: '# spec' },
      ],
      'wordpress',
    )
    expect(out.map((f) => f.path)).toEqual(['design/site/index.html', 'spec/design.md'])
  })

  it('rewrites preview absolute links to local relative html paths for zip', () => {
    const out = normalizePathsForDownload(
      [
        {
          path: 'preview/index.html',
          content: '<a href="/about">About</a>',
        },
        {
          path: 'preview/about/index.html',
          content: '<a href="/">Home</a>',
        },
      ],
      'html',
    )

    const home = out.find((f) => f.path === 'preview/index.html')?.content ?? ''
    const about = out.find((f) => f.path === 'preview/about/index.html')?.content ?? ''
    expect(home).toContain('href="about/index.html"')
    expect(about).toContain('href="../index.html"')
  })
})

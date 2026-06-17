import { describe, expect, it } from 'vitest'
import { filterDeployableFiles } from '@/lib/publish/filterDeployFiles'

describe('filterDeployableFiles', () => {
  it('excludes export/ but keeps preview/', () => {
    const out = filterDeployableFiles(
      [
        { path: 'preview/index.html', content: '<html></html>' },
        { path: 'export/wordpress/style.css', content: '/* */' },
        { path: 'design/pages/home/index.html', content: '<html></html>' },
      ],
      'wordpress',
    )
    const paths = out.map((f) => f.path)
    expect(paths).toContain('preview/index.html')
    expect(paths.some((p) => p.startsWith('export/'))).toBe(false)
    expect(paths.some((p) => p.startsWith('design/'))).toBe(false)
    expect(paths).toContain('vercel.json')
  })
})

import { describe, expect, it } from 'vitest'
import { mergeCodeTemplateConvertOutput } from '@/lib/design/codeTemplateConvert'
import { hasAppSourceFiles } from '@/lib/design/types'

describe('mergeCodeTemplateConvertOutput', () => {
  const tinyPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVQ42mP8z5BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const designFiles = [
    {
      path: 'design/site/index.html',
      content: '<!DOCTYPE html><html><body><h1>Home</h1></body></html>',
    },
    {
      path: 'design/pages/about/index.html',
      content: '<!DOCTYPE html><html><body><h1>About</h1></body></html>',
    },
    {
      path: 'design/mockups/home.png',
      content: tinyPng,
    },
    {
      path: 'design/mockups/about.png',
      content: tinyPng,
    },
  ]

  it('produces preview and vercel.json for html', () => {
    const files = mergeCodeTemplateConvertOutput({
      codeTemplate: 'html',
      projectName: 'Demo',
      framework: 'react',
      designFiles,
      selectedPageIds: ['home', 'about'],
      generatedFromAi: [],
    })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('preview/index.html')
    expect(paths).toContain('preview/about/index.html')
    expect(paths).toContain('vercel.json')
    expect(hasAppSourceFiles(paths)).toBe(true)
  })

  it('produces export scaffold for wordpress', () => {
    const files = mergeCodeTemplateConvertOutput({
      codeTemplate: 'wordpress',
      projectName: 'Tienda',
      framework: 'react',
      designFiles,
      selectedPageIds: ['home'],
      generatedFromAi: [],
    })
    const paths = files.map((f) => f.path)
    expect(paths.some((p) => p.startsWith('export/wordpress/'))).toBe(true)
    expect(paths).toContain('preview/index.html')
    expect(hasAppSourceFiles(paths)).toBe(true)
  })

  it('maps canonical filter/search params for woocommerce export links', () => {
    const files = mergeCodeTemplateConvertOutput({
      codeTemplate: 'woocommerce',
      projectName: 'Tienda',
      framework: 'react',
      designFiles,
      selectedPageIds: ['home'],
      generatedFromAi: [
        {
          path: 'export/wordpress/woocommerce/archive-product.php',
          content:
            '<a href="/shop?q=zapatos&category=hombre&brand=puma&price_min=20&price_max=100&sort=price_asc&page=2">cat</a>',
        },
      ],
    })

    const php =
      files.find((f) => f.path === 'export/wordpress/woocommerce/archive-product.php')?.content ?? ''
    expect(php).toContain('s=zapatos')
    expect(php).toContain('product_cat=hombre')
    expect(php).toContain('filter_pa_brand=puma')
    expect(php).toContain('min_price=20')
    expect(php).toContain('max_price=100')
    expect(php).toContain('orderby=price_asc')
    expect(php).toContain('page=2')
    expect(php).not.toMatch(/(^|[?&])category=hombre(?:&|$)/)
    expect(php).not.toMatch(/(^|[?&])brand=puma(?:&|$)/)
    expect(php).not.toMatch(/(^|[?&])price_min=20(?:&|$)/)
    expect(php).not.toMatch(/(^|[?&])price_max=100(?:&|$)/)
    expect(php).not.toMatch(/(^|[?&])sort=price_asc(?:&|$)/)
  })

  it('uses project override map for woocommerce link params', () => {
    const files = mergeCodeTemplateConvertOutput({
      codeTemplate: 'woocommerce',
      projectName: 'Tienda',
      framework: 'react',
      designFiles,
      selectedPageIds: ['home'],
      codeTemplateLinkParamMap: {
        woocommerce: {
          category: 'cat',
          sort: 'order',
        },
      },
      generatedFromAi: [
        {
          path: 'export/wordpress/woocommerce/archive-product.php',
          content: '<a href="/shop?category=hombre&sort=price_asc">cat</a>',
        },
      ],
    })

    const php =
      files.find((f) => f.path === 'export/wordpress/woocommerce/archive-product.php')?.content ?? ''
    expect(php).toContain('cat=hombre')
    expect(php).toContain('order=price_asc')
    expect(php).not.toMatch(/(^|[?&])product_cat=hombre(?:&|$)/)
    expect(php).not.toMatch(/(^|[?&])orderby=price_asc(?:&|$)/)
  })

  it('produces shopify theme path', () => {
    const files = mergeCodeTemplateConvertOutput({
      codeTemplate: 'shopify',
      projectName: 'Shop',
      framework: 'react',
      designFiles,
      selectedPageIds: ['home'],
      generatedFromAi: [],
    })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('export/shopify/theme/layout/theme.liquid')
    expect(paths).toContain('export/shopify/theme/sections/main-page.liquid')
    expect(paths).toContain('export/shopify/theme/assets/theme.css')
    expect(paths).toContain('preview/index.html')
  })

  it('normalizes AI shopify paths without export prefix', () => {
    const files = mergeCodeTemplateConvertOutput({
      codeTemplate: 'shopify',
      projectName: 'Shop',
      framework: 'react',
      designFiles,
      selectedPageIds: ['home'],
      generatedFromAi: [
        { path: 'sections/hero.liquid', content: '<section>Hero</section>' },
        { path: 'assets/custom.css', content: 'body{}' },
      ],
    })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('export/shopify/theme/sections/hero.liquid')
    expect(paths).toContain('export/shopify/theme/assets/custom.css')
  })

  it('normalizes placeholder and design-page links in generated files', () => {
    const files = mergeCodeTemplateConvertOutput({
      codeTemplate: 'html',
      projectName: 'Demo',
      framework: 'react',
      designFiles,
      selectedPageIds: ['home', 'about'],
      generatedFromAi: [
        {
          path: 'preview/index.html',
          content:
            '<a href="#">home</a><a href="javascript:void(0)">cta</a><a href="/pages/about">about</a>',
        },
      ],
    })
    const html = files.find((f) => f.path === 'preview/index.html')?.content ?? ''
    expect(html).toContain('href="/"')
    expect(html).toContain('href="/about"')
    expect(html).not.toContain('href="#"')
    expect(html).not.toContain('javascript:void(0)')

    const reportRaw = files.find((f) => f.path === 'spec/link-validation.json')?.content ?? ''
    const report = JSON.parse(reportRaw) as {
      summary: { fixed: number; unresolved: number }
      fixed: Array<{ from: string; to: string }>
    }
    expect(report.summary.fixed).toBeGreaterThan(0)
    expect(report.summary.unresolved).toBeGreaterThanOrEqual(0)
    expect(report.fixed.some((x) => x.from === '/pages/about' && x.to === '/about')).toBe(true)
  })

  it('keeps pages interlinked with canonical routes from nested preview pages', () => {
    const files = mergeCodeTemplateConvertOutput({
      codeTemplate: 'html',
      projectName: 'Demo',
      framework: 'react',
      designFiles,
      selectedPageIds: ['home', 'about'],
      generatedFromAi: [
        {
          path: 'preview/about/index.html',
          content:
            '<a href="../index.html">home</a><a href="/pages/home">h2</a><a href="about.html">self</a>',
        },
      ],
    })
    const html = files.find((f) => f.path === 'preview/about/index.html')?.content ?? ''
    expect(html).toContain('href="/"')
    expect(html).toContain('href="/about"')
    expect(html).not.toContain('../index.html')
    expect(html).not.toContain('/pages/home')
  })

  it('uses page names as routes for screen-* ids', () => {
    const designFilesWithSpec = [
      ...designFiles,
      {
        path: 'spec/design.json',
        content: JSON.stringify({
          version: 2,
          title: 'Demo',
          summary: '',
          tokens: {},
          pages: [
            { id: 'home', name: 'Inicio', path: 'design/site/index.html' },
            {
              id: 'screen-mpnvkvcb',
              name: 'Detalle Producto',
              path: 'design/pages/screen-mpnvkvcb/index.html',
            },
          ],
        }),
      },
      {
        path: 'design/pages/screen-mpnvkvcb/index.html',
        content: '<!DOCTYPE html><html><body><h1>Detalle</h1></body></html>',
      },
    ]

    const files = mergeCodeTemplateConvertOutput({
      codeTemplate: 'html',
      projectName: 'Demo',
      framework: 'react',
      designFiles: designFilesWithSpec,
      selectedPageIds: ['home', 'screen-mpnvkvcb'],
      generatedFromAi: [
        {
          path: 'preview/index.html',
          content: '<a href="/pages/screen-mpnvkvcb">detalle</a>',
        },
      ],
    })

    const paths = files.map((f) => f.path)
    expect(paths).toContain('preview/detalle-producto/index.html')
    const html = files.find((f) => f.path === 'preview/index.html')?.content ?? ''
    expect(html).toContain('href="/detalle-producto"')
    expect(html).not.toContain('/screen-mpnvkvcb')
  })

  it('adds screenshots folder with one image per selected page', () => {
    const files = mergeCodeTemplateConvertOutput({
      codeTemplate: 'html',
      projectName: 'Demo',
      framework: 'react',
      designFiles,
      selectedPageIds: ['home', 'about'],
      generatedFromAi: [],
    })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('screenshots/home.png')
    expect(paths).toContain('screenshots/about.png')
    expect(paths).toContain('screenshots/manifest.json')

    const manifestRaw = files.find((f) => f.path === 'screenshots/manifest.json')?.content ?? ''
    const manifest = JSON.parse(manifestRaw) as {
      version: number
      entries: Array<{
        pageId: string
        name: string
        path: string
        route: string
        title: string
      }>
    }
    expect(manifest.version).toBe(1)
    expect(manifest.entries).toEqual([
      {
        pageId: 'about',
        name: 'About',
        path: 'screenshots/about.png',
        route: '/about',
        title: 'About',
      },
      {
        pageId: 'home',
        name: 'Inicio',
        path: 'screenshots/home.png',
        route: '/',
        title: 'Inicio',
      },
    ])
  })
})

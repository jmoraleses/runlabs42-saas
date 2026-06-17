import { describe, expect, it } from 'vitest'
import {
  DESIGN_LAYOUT_PATH,
  DESIGN_TOKENS_PATH,
  extractJsonFromModelText,
  jsonFileFromModelResponse,
  layoutFromModelResponse,
  normalizeOrchestrationHtmlFiles,
  parseLayoutNavigationLinks,
  parseLayoutPages,
  parseOrchestrationHtmlFiles,
  selectOrchestrationHtmlForPage,
  synthesizeOrchestrationSpec,
} from '@/lib/design/orchestrationParse'

describe('extractJsonFromModelText', () => {
  it('parses raw JSON objects', () => {
    const obj = extractJsonFromModelText('{"brand":{"tone":"calm"}}')
    expect(obj).toEqual({ brand: { tone: 'calm' } })
  })

  it('parses fenced JSON blocks', () => {
    const obj = extractJsonFromModelText('```json\n{"pages":[{"id":"home"}]}\n```')
    expect(obj).toEqual({ pages: [{ id: 'home' }] })
  })
})

describe('jsonFileFromModelResponse', () => {
  it('builds canonical token file from raw JSON', () => {
    const file = jsonFileFromModelResponse(
      '{"brand":{"concept":"Café"},"tokens":{"colors":{"primary":"#000"}}}',
      DESIGN_TOKENS_PATH,
    )
    expect(file?.path).toBe(DESIGN_TOKENS_PATH)
    expect(JSON.parse(file!.content)).toMatchObject({ brand: { concept: 'Café' } })
  })
})

describe('normalizeOrchestrationHtmlFiles', () => {
  const layout = [{ id: 'home', name: 'Inicio' }, { id: 'pricing', name: 'Precios' }]

  it('remaps root index.html to design/site/index.html', () => {
    const out = normalizeOrchestrationHtmlFiles(
      [{ path: 'index.html', content: '<!DOCTYPE html><html></html>' }],
      layout,
    )
    expect(out[0]?.path).toBe('design/site/index.html')
  })

  it('keeps canvas paths as-is', () => {
    const out = normalizeOrchestrationHtmlFiles(
      [{ path: 'design/pages/pricing/index.html', content: '<html></html>' }],
      layout,
    )
    expect(out[0]?.path).toBe('design/pages/pricing/index.html')
  })
})

describe('synthesizeOrchestrationSpec', () => {
  it('creates spec/design.json with pages from layout', () => {
    const tokensJson = JSON.stringify({
      brand: { concept: 'Tienda', tone: 'fresco' },
      tokens: { colors: { primary: '#111' } },
    })
    const layoutJson = JSON.stringify({
      pages: [
        { id: 'home', name: 'Inicio' },
        { id: 'catalog', name: 'Catálogo' },
      ],
    })
    const specFile = synthesizeOrchestrationSpec({
      tokensJson,
      layoutJson,
      device: 'desktop',
      htmlFiles: [{ path: 'design/site/index.html', content: '<html></html>' }],
    })
    expect(specFile?.path).toBe('spec/design.json')
    const spec = JSON.parse(specFile!.content)
    expect(spec.pages).toHaveLength(3)
    expect(spec.pages[0].frameType).toBe('designSystem')
    expect(spec.pages[0].x).toBe(0)
    expect(spec.pages[1].path).toBe('design/site/index.html')
    expect(spec.pages[2].path).toBe('design/pages/catalog/index.html')
    expect(spec.pages[1].x).toBeGreaterThan(spec.pages[0].x)
  })
})

describe('selectOrchestrationHtmlForPage', () => {
  it('fuerza la ruta de la pantalla objetivo aunque el modelo cite home', () => {
    const homeHtml = '<!DOCTYPE html><html><body><main>HOME_ORIGINAL</main></body></html>'
    const files = [
      { path: 'design/site/index.html', content: homeHtml },
      { path: 'design/pages/pricing/index.html', content: '<main>Pricing</main>' },
    ]
    const selected = selectOrchestrationHtmlForPage(files, 'screen-new')
    expect(selected?.path).toBe('design/pages/screen-new/index.html')
    expect(selected?.content).toBe(homeHtml)
  })

  it('prefiere el bloque que ya coincide con la pantalla', () => {
    const files = [
      { path: 'design/site/index.html', content: '<main>Home</main>' },
      { path: 'design/pages/about/index.html', content: '<main>About</main>' },
    ]
    const selected = selectOrchestrationHtmlForPage(files, 'about')
    expect(selected?.path).toBe('design/pages/about/index.html')
    expect(selected?.content).toContain('About')
  })
})

describe('parseOrchestrationHtmlFiles', () => {
  it('parses fenced html with explicit design paths', () => {
    const html = [
      '```html design/site/index.html',
      '<!DOCTYPE html><html><body><main data-sk-id="sk-1">Hola</main></body></html>',
      '```',
    ].join('\n')
    const files = parseOrchestrationHtmlFiles(html, [{ id: 'home', name: 'Inicio' }])
    expect(files).toHaveLength(1)
    expect(files[0]?.path).toBe('design/site/index.html')
  })
})

describe('parseLayoutPages', () => {
  it('returns normalized page ids', () => {
    const pages = parseLayoutPages(JSON.stringify({ pages: [{ id: 'home', name: 'Inicio' }] }))
    expect(pages).toEqual([{ id: 'home', name: 'Inicio' }])
  })

  it('accepts screens alias and slug ids', () => {
    const pages = parseLayoutPages(
      JSON.stringify({
        screens: [{ slug: 'home', title: 'Inicio' }, { slug: 'pricing', title: 'Precios' }],
      }),
    )
    expect(pages.map((p) => p.id)).toEqual(['home', 'pricing'])
    expect(pages[0]?.name).toBe('Inicio')
  })

  it('accepts nested layout.pages', () => {
    const pages = parseLayoutPages(
      JSON.stringify({ layout: { pages: [{ id: 'home', name: 'Inicio' }] } }),
    )
    expect(pages).toHaveLength(1)
    expect(pages[0]?.id).toBe('home')
  })

  it('accepts pages as id map', () => {
    const pages = parseLayoutPages(
      JSON.stringify({
        home: {
          name: 'Inicio',
          sections: [{ type: 'bento', composition: 'asymmetric' }],
        },
        pricing: {
          name: 'Precios',
          sections: [{ type: 'comparison', composition: 'tiers' }],
        },
      }),
    )
    expect(pages.map((p) => p.id)).toEqual(['home', 'pricing'])
  })

  it('parses layout from markdown array without object wrapper', () => {
    const { pages, layoutJson } = layoutFromModelResponse(
      'Plan:\n```json\n[{"id":"home","name":"Inicio","sections":[{"type":"marquee"}]}]\n```',
    )
    expect(pages).toHaveLength(1)
    expect(pages[0]?.id).toBe('home')
    expect(JSON.parse(layoutJson).pages).toHaveLength(1)
  })
})

describe('parseLayoutNavigationLinks', () => {
  it('reads navigationLinks from layout JSON', () => {
    const links = parseLayoutNavigationLinks(
      JSON.stringify({
        pages: [{ id: 'home' }, { id: 'pricing' }],
        navigationLinks: [
          {
            fromPageId: 'home',
            toPageId: 'pricing',
            label: 'Precios',
            anchorSkId: 'sk-nav-pricing',
          },
        ],
      }),
    )
    expect(links).toHaveLength(1)
    expect(links[0]?.anchorSkId).toBe('sk-nav-pricing')
  })

  it('layoutFromModelResponse preserves navigationLinks', () => {
    const result = layoutFromModelResponse(
      JSON.stringify({
        pages: [{ id: 'home', name: 'Inicio' }],
        navigationLinks: [{ fromPageId: 'home', toPageId: 'pricing', label: 'Precios' }],
      }),
    )
    expect(result.navigationLinks).toHaveLength(1)
    expect(JSON.parse(result.layoutJson).navigationLinks).toHaveLength(1)
  })
})

import { pageHtmlPath } from '@/lib/design/pages'

export const MOCK_TOKENS = {
  brand: { tone: 'orgánico premium', concept: 'Cactus Haven' },
  tokens: {
    colors: {
      primary: '#2d5016',
      secondary: '#8b7355',
      tertiary: '#c4a574',
      neutral: '#e5e0d8',
      background: '#faf8f5',
      surface: '#ffffff',
      text: '#1a1a1a',
      border: '#e5e0d8',
    },
    typography: { heading: 'Syne', body: 'Inter', baseSize: '16px', scale: '1.25' },
    ui: { borderRadius: '16px', borderWidth: '1px', layoutStyle: 'asymmetric-grid', spacingUnit: '8px' },
  },
}

export const MOCK_PALETTE_ONLY = {
  brand: MOCK_TOKENS.brand,
  tokens: { colors: MOCK_TOKENS.tokens.colors },
}

export const MOCK_TYPOGRAPHY_UI = {
  tokens: {
    typography: MOCK_TOKENS.tokens.typography,
    ui: MOCK_TOKENS.tokens.ui,
  },
}

export const MOCK_LAYOUT_CLASSIC = {
  pages: [
    {
      id: 'home',
      name: 'Inicio',
      layoutStrategy: 'classic',
      sections: [
        { type: 'navigation' },
        { type: 'hero' },
        { type: 'features' },
        { type: 'footer' },
      ],
    },
  ],
}

export const MOCK_LAYOUT_VALID = {
  pages: [
    {
      id: 'home',
      name: 'Inicio',
      layoutStrategy: 'bento-hero',
      sections: [
        { type: 'navigation', style: 'minimal' },
        { type: 'bento', composition: 'asymmetric' },
        { type: 'marquee', composition: 'full-bleed' },
      ],
    },
    {
      id: 'pricing',
      name: 'Precios',
      layoutStrategy: 'split-pricing',
      sections: [
        { type: 'navigation' },
        { type: 'split-narrative', composition: 'left-heavy' },
        { type: 'testimonial-wall' },
      ],
    },
  ],
}

export const MOCK_ASSET_PLAN_EMPTY = { assets: [] as Array<{ path: string; prompt: string }> }

export const MOCK_ASSET_PLAN_HERO = {
  assets: [
    {
      path: 'design/site/assets/hero.jpg',
      prompt: 'Wide botanical hero photograph, premium succulents',
      aspect: '16:9',
    },
    {
      path: 'design/site/assets/product.jpg',
      prompt: 'Product photo succulent on neutral background',
      aspect: '1:1',
    },
  ],
}

export function mockOrchestrationHtml(pageId: string): string {
  const path = pageHtmlPath(pageId)
  const title = pageId === 'home' ? 'Cactus Haven' : pageId
  const filler = 'Sección de contenido editorial con copy de demostración. '.repeat(28)
  return [
    '```html ' + path,
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head><meta charset="utf-8"><style>:root{--primary:#2d5016;color:#1a1a1a}</style></head>',
    `<body><header data-sk-id="sk-nav"><nav>${title}</nav></header>`,
    `<main data-sk-id="sk-main"><h1 data-sk-id="sk-h1">${title}</h1><p data-sk-id="sk-lead">${filler}</p></main>`,
    '<footer data-sk-id="sk-footer"><small>Pie</small></footer>',
    '</body></html>',
    '```',
  ].join('\n')
}

import { RICH_STITCH_DESIGN_MD } from '@/lib/design/__tests__/fixtures/stitchDesignMdFixture'

export const MOCK_DESIGN_MD = RICH_STITCH_DESIGN_MD.replace(
  'Organic Minimalist Botanical',
  'Cactus Haven',
)

export function mockDesignMdResponse(): string {
  return '```markdown spec/design.md\n' + MOCK_DESIGN_MD + '\n```'
}

export function mockDesignMdStepResponse(prompt: string): string {
  const idMatch = prompt.match(/## design-md-step-id:\s*(\S+)/)
  const stepId = idMatch?.[1] ?? 'name'
  const md = MOCK_DESIGN_MD

  if (stepId === 'name') {
    const name = md.match(/^name:\s*(.+)$/m)?.[1] ?? 'Cactus Haven'
    return `name: ${name}`
  }

  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
  if (stepId === 'colors-surfaces' || stepId === 'colors-roles') {
    const colorsBody = fm.match(/^colors:\r?\n([\s\S]*?)(?=^typography:)/m)?.[1] ?? ''
    const lines = colorsBody.split('\n').filter((l) => l.trim())
    const surfaces: string[] = []
    const roles: string[] = []
    for (const line of lines) {
      const key = line.trim().match(/^([a-z0-9-]+):/i)?.[1]
      if (!key) continue
      if (/^(surface|on-surface|inverse|outline|background|surface-variant|surface-tint)/i.test(key)) {
        surfaces.push(line.trim())
      } else {
        roles.push(line.trim())
      }
    }
    return stepId === 'colors-surfaces' ? surfaces.join('\n') : roles.join('\n')
  }

  if (stepId === 'typography') {
    return fm.match(/^typography:\r?\n([\s\S]*?)(?=^rounded:)/m)?.[1]?.trimEnd() ?? ''
  }
  if (stepId === 'shape-spacing') {
    const rounded = fm.match(/^rounded:\r?\n([\s\S]*?)(?=^spacing:)/m)?.[1]
    const spacing = fm.match(/^spacing:\r?\n([\s\S]*?)$/m)?.[1]
    return [
      rounded ? `rounded:\n${rounded.trimEnd()}` : '',
      spacing ? `spacing:\n${spacing.trimEnd()}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const sectionMap: Record<string, string> = {
    'section-brand': '## Brand & Style',
    'section-colors': '## Colors',
    'section-typography': '## Typography',
    'section-layout': '## Layout & Spacing',
    'section-elevation': '## Elevation & Depth',
    'section-shapes': '## Shapes',
    'section-components': '## Components',
  }
  const heading = sectionMap[stepId]
  if (heading) {
    const body = md.slice(md.indexOf('\n---\n') + 5)
    const re = new RegExp(
      `(${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?)(?=\\n## |$)`,
    )
    return body.match(re)?.[1]?.trim() ?? `${heading}\n\nSection for tests.`
  }

  return mockDesignMdResponse()
}

export function mockHtmlPartResponse(prompt: string): string {
  const idMatch = prompt.match(/## html-part-id:\s*(\S+)/)
  const partId = idMatch?.[1] ?? 'shell'
  const pageId = pageIdFromContentPrompt(prompt)
  const title = pageId === 'home' ? 'Cactus Haven' : pageId
  const dense =
    '<p data-sk-id="sk-p-dense">Descripción visual densa del producto.</p>'.repeat(40)

  if (partId === 'shell') {
    return [
      '<!DOCTYPE html>',
      '<html lang="es"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      `<title>${title}</title>`,
      '<style>:root{--primary:#2d5016}body{margin:0;font-family:Inter,sans-serif}</style>',
      '</head><body>',
      `<header data-sk-id="sk-nav"><strong data-sk-id="sk-brand">${title}</strong></header>`,
      '<main data-sk-id="sk-main">',
    ].join('')
  }

  if (partId === 'footer') {
    return '</main><footer data-sk-id="sk-footer"><small>Pie</small></footer></body></html>'
  }

  if (prompt.includes('Tienda sin html wrapper')) {
    return '<section class="block"><h2>Producto</h2><p>Descripción visual densa.</p></section>'.repeat(
      120,
    )
  }

  if (prompt.includes('Tienda visual')) {
    return (
      '<article class="card"><h2>Catálogo</h2><p>Detalle visual.</p></article>'.repeat(90)
    )
  }

  const secMatch = partId.match(/^section-(\d+)$/)
  const idx = secMatch?.[1] ?? '0'
  return `<section data-sk-id="sk-sec-${idx}"><h2 data-sk-id="sk-h-${idx}">${title}</h2>${dense}</section>`
}

export function systemInstructionKind(systemInstruction: string): string {
  if (systemInstruction.includes('PASO HTML')) return 'html-part'
  if (systemInstruction.includes('PASO design.md')) return 'design-md-step'
  if (systemInstruction.includes('Google Stitch')) return 'design-md'
  if (systemInstruction.includes('AGENTE DE PALETA')) return 'palette'
  if (systemInstruction.includes('AGENTE DE TIPOGRAFÍA')) return 'typography'
  if (systemInstruction.includes('AGENTE DE REVISIÓN DE HTML')) return 'html-review'
  if (systemInstruction.includes('AGENTE DE REVISIÓN DE TOKENS')) return 'tokens-review'
  if (systemInstruction.includes('director de arte')) return 'tokens'
  if (systemInstruction.includes('arquitecto de interfaces')) return 'layout'
  if (systemInstruction.includes('director creativo')) return 'assets'
  if (systemInstruction.includes('desarrollador frontend')) return 'content'
  return 'unknown'
}

export function pageIdFromContentPrompt(prompt: string): string {
  const m = prompt.match(/id "([^"]+)"/)
  if (m?.[1]) return m[1]
  const pathM = prompt.match(/```html\s+(\S+)/)
  if (pathM?.[1]) {
    const path = pathM[1]
    if (path.includes('design/pages/')) {
      const idM = path.match(/design\/pages\/([^/]+)\//)
      return idM?.[1] ?? 'home'
    }
    return 'home'
  }
  return 'home'
}

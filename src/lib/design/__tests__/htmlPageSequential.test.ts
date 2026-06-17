import { describe, expect, it, vi } from 'vitest'
import {
  assemblePageHtmlFromParts,
  buildPageHtmlParts,
  isPreviewableIncrementalPageHtml,
  parseHtmlPartOutput,
} from '@/lib/design/htmlPageSequential'

vi.mock('@/lib/design/stitchParity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/design/stitchParity')>()
  return {
    ...actual,
    isStitchParityEnabled: (modelId?: string) => modelId === 'stitch-test',
  }
})

describe('htmlPageSequential', () => {
  it('shell Stitch pide Tailwind CDN en el task', () => {
    const parts = buildPageHtmlParts({ id: 'home', name: 'Inicio' }, '---\ncolors:\n  primary: "#000"\n---', 'stitch-test')
    expect(parts[0]?.task).toContain('cdn.tailwindcss.com')
    expect(parts[0]?.task).toMatch(/PRIMERO/i)
    expect(parts[0]?.task).toContain('fontSize')
    expect(parts[0]?.task).not.toMatch(/<style> con :root/)
  })

  it('define shell, secciones del layout y footer', () => {
    const parts = buildPageHtmlParts({
      id: 'home',
      name: 'Inicio',
      sections: [
        { type: 'hero', description: 'Hero' },
        { type: 'features', description: 'Grid' },
      ],
    })
    expect(parts[0]?.id).toBe('shell')
    expect(parts[parts.length - 1]?.id).toBe('footer')
    expect(parts.filter((p) => p.id.startsWith('section-'))).toHaveLength(2)
  })

  it('ensambla documento incremental', () => {
    const html = assemblePageHtmlFromParts({
      shell:
        '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head><body><header data-sk-id="sk-nav">Nav</header><main data-sk-id="sk-main">',
      sections: [
        `<section data-sk-id="sk-sec-0"><h1>Hola</h1><p>${'Texto de prueba con suficiente contenido visible. '.repeat(8)}</p></section>`,
      ],
      footer: '</main><footer data-sk-id="sk-footer">Pie</footer></body></html>',
    })
    expect(html).toContain('</html>')
    expect(html).toContain('sk-sec-0')
    expect(isPreviewableIncrementalPageHtml(html)).toBe(true)
  })

  it('parsea fragmentos por paso', () => {
    expect(parseHtmlPartOutput('<header data-sk-id="sk-nav">X</header>', 'shell')).toContain(
      'header',
    )
    expect(
      parseHtmlPartOutput('<section data-sk-id="sk-a"><p>Bloque</p></section>', 'section-0'),
    ).toContain('section')
    expect(parseHtmlPartOutput('</main><footer>Pie</footer></body></html>', 'footer')).toContain(
      'footer',
    )
  })
})

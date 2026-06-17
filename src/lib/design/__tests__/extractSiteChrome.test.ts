import { describe, expect, it } from 'vitest'
import {
  extractBalancedTagOuterHtml,
  extractElementHtmlBySkId,
  extractSiteChromeFromHtml,
  formatSiteChromeForPagePrompt,
  sortPagesWithHomeFirst,
} from '@/lib/design/extractSiteChrome'
import type { DesignPageMeta } from '@/lib/design/types'

describe('extractBalancedTagOuterHtml', () => {
  it('handles nested tags of same name', () => {
    const html = '<div><header class="outer"><span></span></header></div>'
    expect(extractBalancedTagOuterHtml(html, 'header')).toBe(
      '<header class="outer"><span></span></header>',
    )
  })
})

describe('sortPagesWithHomeFirst', () => {
  it('moves home/inicio to front', () => {
    const pages: DesignPageMeta[] = [
      { id: 'products', name: 'Productos', path: 'a.html', x: 0, y: 0 },
      { id: 'home', name: 'Inicio', path: 'b.html', x: 0, y: 0 },
    ]
    expect(sortPagesWithHomeFirst(pages)[0]?.id).toBe('home')
  })
})

describe('extractElementHtmlBySkId', () => {
  it('extrae img autocontenido', () => {
    const html = `<img src="assets/x.jpg" data-sk-id="sk-x" alt="X">`
    expect(extractElementHtmlBySkId(html, 'sk-x')).toContain('sk-x')
  })

  it('extrae contenedor con descendientes', () => {
    const page = `<div data-sk-id="sk-wrap"><img src="assets/a.jpg" alt="A"></div><img src="assets/b.jpg">`
    expect(extractElementHtmlBySkId(page, 'sk-wrap')).toContain('assets/a.jpg')
    expect(extractElementHtmlBySkId(page, 'sk-wrap')).not.toContain('assets/b.jpg')
  })
})

describe('extractSiteChromeFromHtml', () => {
  it('extracts header and footer', () => {
    const html = `<!DOCTYPE html><html><head><style>
.site-header { padding: 8px; }
main { padding: 24px; }
.site-footer { color: #666; }
</style></head><body>
<header class="site-header" data-sk-id="sk-header"><nav data-sk-id="sk-nav"><a href="#">Inicio</a></nav></header>
<main><h1>Productos</h1></main>
<footer data-sk-id="sk-footer"><p>© 2026</p></footer>
</body></html>`
    const chrome = extractSiteChromeFromHtml(html, { pageId: 'home', pageName: 'Inicio' })
    expect(chrome?.header).toContain('sk-header')
    expect(chrome?.footer).toContain('sk-footer')
    expect(chrome?.nav).toBeNull()
    expect(chrome?.chromeCss).toContain('.site-header')
    expect(chrome?.chromeCss).not.toContain('main {')
  })

  it('format prompt mentions target page', () => {
    const chrome = extractSiteChromeFromHtml(
      '<header><nav></nav></header><main></main><footer></footer>',
      { pageId: 'home', pageName: 'Inicio' },
    )!
    const prompt = formatSiteChromeForPagePrompt(chrome, 'Productos')
    expect(prompt).toContain('Inicio')
    expect(prompt).toContain('Productos')
    expect(prompt).toContain('Header (copiar idéntico)')
  })
})

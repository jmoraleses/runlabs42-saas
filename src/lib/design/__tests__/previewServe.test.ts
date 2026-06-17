import { describe, expect, it } from 'vitest'
import {
  injectDesignPreviewBoot,
  neutralizeDesignNavigationLinks,
  rewriteDesignHtml,
} from '@/lib/design/previewServe'

describe('neutralizeDesignNavigationLinks', () => {
  it('replaces root-relative href with hash and preserves original', () => {
    const html = '<nav><a href="/precios">Precios</a><a href="contacto.html">Contacto</a></nav>'
    const out = neutralizeDesignNavigationLinks(html)
    expect(out).toMatch(/<a\s[^>]*href="#"[^>]*data-sk-design-href="\/precios"/)
    expect(out).toMatch(/<a\s[^>]*href="#"[^>]*data-sk-design-href="contacto\.html"/)
  })

  it('leaves external and api links unchanged', () => {
    const html =
      '<a href="https://example.com">Ext</a><a href="/api/foo">Api</a><a href="#top">Hash</a>'
    const out = neutralizeDesignNavigationLinks(html)
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('href="/api/foo"')
    expect(out).toContain('href="#top"')
  })
})

describe('rewriteDesignHtml', () => {
  it('injects design preview flag and bridge script', () => {
    const html = '<!DOCTYPE html><html><body><a href="/inicio">Inicio</a></body></html>'
    const out = rewriteDesignHtml(html, 'proj-1', 'design/site/index.html')
    expect(out).toContain('__RUNLABS42_DESIGN_PREVIEW__=true')
    expect(out).toContain('runlabs42-visual-edit')
    expect(out).toMatch(/<a\s[^>]*href="#"[^>]*data-sk-design-href="\/inicio"/)
  })

  it('inyecta CSS de degradado aunque el bridge visual ya exista', () => {
    const html =
      '<!DOCTYPE html><html><head></head><body><script>/* runlabs42-visual-edit */</script></body></html>'
    const out = injectDesignPreviewBoot(html)
    expect(out).toContain('runlabs42-design-loading-css')
    expect(out).toContain('rl42-blue-drift')
    expect(out).toContain('runlabs42-visual-edit')
  })

  it('elimina HTML en crudo que quedó tras </html> al servir el preview', () => {
    const doc =
      '<!DOCTYPE html><html><head></head><body><main><h1>OK</h1></main></body></html>'
    const leaked = `${doc}\n<div class="raw-leak">visible</div>`
    const out = rewriteDesignHtml(leaked, 'proj-1', 'design/site/index.html')
    expect(out).toContain('<h1>OK</h1>')
    expect(out).not.toContain('raw-leak')
  })

  it('conserva tailwind.config del HTML si design.md no tiene colores', () => {
    const html =
      '<!DOCTYPE html><html><head>' +
      '<script src="https://cdn.tailwindcss.com"></script>' +
      '<script id="tailwind-config">tailwind.config={theme:{extend:{colors:{primary:"#ffd700"}}}}</script>' +
      '</head><body class="bg-primary"></body></html>'
    const minimalMd = '# Importado\nSin YAML de colores.\n'
    const out = rewriteDesignHtml(html, 'proj-1', 'design/site/index.html', 1, minimalMd)
    expect(out).toContain('#ffd700')
    expect(out).not.toContain('runlabs42-design-theme')
  })

  it('no inyecta theme.md en HTML Stitch con Tailwind CDN', () => {
    const html =
      '<!DOCTYPE html><html><head>' +
      '<script src="https://cdn.tailwindcss.com"></script>' +
      '<script id="tailwind-config">tailwind.config={}</script>' +
      '</head><body class="bg-primary"></body></html>'
    const designMd = '---\ncolors:\n  primary: "#061b0e"\n---\n# Design'
    const out = rewriteDesignHtml(html, 'proj-1', 'design/site/index.html', 1, designMd)
    expect(out).toContain('cdn.tailwindcss.com')
    expect(out).not.toContain('runlabs42-design-theme')
    expect(out).not.toContain('runlabs42-design-fonts')
  })

  it('resuelve img assets con segmentos de ruta (no encodeURIComponent del path completo)', () => {
    const html =
      '<img src="assets/hero.jpg" alt="hero">'
    const out = rewriteDesignHtml(html, 'proj-1', 'design/pages/catalogue/index.html')
    expect(out).toContain(
      '/api/projects/proj-1/design/preview/file/design/pages/catalogue/assets/hero.jpg',
    )
    expect(out).not.toContain('%2F')
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  collectDesignImageRequests,
  normalizeDesignImagePath,
  parseImageRequestsFromHtml,
} from '@/lib/design/designImageRequests'

describe('normalizeDesignImagePath', () => {
  it('resuelve rutas relativas de página', () => {
    expect(normalizeDesignImagePath('design/pages/products/assets/hero.jpg')).toBe(
      'design/pages/products/assets/hero.jpg',
    )
    expect(normalizeDesignImagePath('assets/hero.jpg')).toBe('design/site/assets/hero.jpg')
  })
})

describe('parseImageRequestsFromHtml', () => {
  it('extrae img src relativos con prompt desde alt', () => {
    const html = `<img src="assets/hero-background.jpg" alt="Modern flower shop hero" data-sk-id="sk-hero">`
    const reqs = parseImageRequestsFromHtml(html, 'design/site/index.html')
    expect(reqs).toHaveLength(1)
    expect(reqs[0]?.path).toBe('design/site/assets/hero-background.jpg')
    expect(reqs[0]?.prompt).toContain('Modern flower shop hero')
  })

  it('resuelve assets de subpáginas', () => {
    const html = `<img src="assets/product-placeholder-1.jpg" alt="Rose bouquet">`
    const reqs = parseImageRequestsFromHtml(html, 'design/pages/products/index.html')
    expect(reqs[0]?.path).toBe('design/pages/products/assets/product-placeholder-1.jpg')
  })

  it('ignora URLs externas y data:', () => {
    const html = `
      <img src="https://example.com/x.jpg" alt="x">
      <img src="data:image/png;base64,abc" alt="y">
      <img src="assets/local.jpg" alt="Local">
    `
    const reqs = parseImageRequestsFromHtml(html, 'design/site/index.html')
    expect(reqs).toHaveLength(1)
    expect(reqs[0]?.path).toBe('design/site/assets/local.jpg')
  })
})

describe('collectDesignImageRequests', () => {
  it('combina tags [IMAGE:] e img del HTML sin duplicar', () => {
    const html = `<img src="assets/extra.jpg" alt="Extra photo">`
    const text = `[IMAGE: design/site/assets/hero.jpg | Hero banner | 16:9]\n${html}`
    const reqs = collectDesignImageRequests([text], {
      pageHtmlPath: 'design/site/index.html',
    })
    expect(reqs.map((r) => r.path)).toEqual([
      'design/site/assets/hero.jpg',
      'design/site/assets/extra.jpg',
    ])
  })

  it('con marcador de elemento solo incluye imágenes de ese subtree', () => {
    const html = `<section data-sk-id="sk-hero">
  <img src="assets/hero.jpg" alt="Hero" data-sk-id="sk-hero-img">
</section>
<img src="assets/other.jpg" alt="Other" data-sk-id="sk-other">`
    const text = `[IMAGE: design/site/assets/hero.jpg | New hero | 16:9]
[IMAGE: design/site/assets/other.jpg | Other image | 1:1]
[IMAGE: design/site/assets/extra.jpg | Extra | 4:3]`
    const reqs = collectDesignImageRequests([text, html], {
      pageHtmlPath: 'design/site/index.html',
      htmlFiles: [{ path: 'design/site/index.html', content: html }],
      elementSkId: 'sk-hero-img',
    })
    expect(reqs.map((r) => r.path)).toEqual(['design/site/assets/hero.jpg'])
  })

  it('enriquece prompts inferidos con el brief del usuario', () => {
    const html = `<img src="assets/hero-pollitos.jpg" alt="Hero" />`
    const reqs = collectDesignImageRequests([html], {
      pageHtmlPath: 'design/site/home.html',
      htmlFiles: [{ path: 'design/site/home.html', content: html }],
      brief: { prompt: 'Granja de pollitos orgánicos premium' },
    })
    expect(reqs[0]?.prompt.toLowerCase()).toContain('pollito')
  })
})

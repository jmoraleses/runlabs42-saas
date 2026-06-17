import { describe, expect, it } from 'vitest'
import { inlineDesignPageAssets } from '@/lib/design/inlineDesignPageAssets'

describe('inlineDesignPageAssets', () => {
  it('sustituye src de assets locales por data URL', () => {
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const html = `<!DOCTYPE html><html><body><img src="assets/hero.png" alt=""></body></html>`
    const out = inlineDesignPageAssets(html, 'design/pages/home/index.html', [
      { path: 'design/pages/home/assets/hero.png', content: tinyPng },
    ])
    expect(out).toContain('data:image/png;base64,')
    expect(out).not.toContain('src="assets/hero.png"')
  })

  it('sustituye assets desde design/site/assets/ cuando HTML es design/pages/', () => {
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const html = `<!DOCTYPE html><html><body><img src="assets/hero.jpg" alt=""></body></html>`
    const out = inlineDesignPageAssets(html, 'design/pages/home/index.html', [
      { path: 'design/site/assets/hero.jpg', content: tinyPng },
    ])
    expect(out).toContain('data:image/png;base64,')
    expect(out).not.toContain('src="assets/hero.jpg"')
  })
})

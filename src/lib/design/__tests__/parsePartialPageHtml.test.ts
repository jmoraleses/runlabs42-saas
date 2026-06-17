import { describe, expect, it } from 'vitest'
import {
  ensurePreviewableHtml,
  parsePartialSinglePageHtml,
} from '@/lib/design/parsePartialPageHtml'
import type { DesignPageMeta } from '@/lib/design/types'

const page: DesignPageMeta = {
  id: 'home',
  name: 'Inicio',
  path: 'design/pages/home/index.html',
  x: 0,
  y: 0,
  width: 390,
  height: 844,
  media: 'html',
}

describe('parsePartialSinglePageHtml', () => {
  it('wraps HTML fragments without document root', () => {
    const wrapped = ensurePreviewableHtml('<header><h1>Hola</h1></header>')
    expect(wrapped).toMatch(/<!DOCTYPE html>/i)
    expect(wrapped).toContain('<header><h1>Hola</h1></header>')
  })

  it('parses incomplete fenced html during stream', () => {
    const partial =
      '```html design/pages/home/index.html\n<main><h1>Purrfect Palate</h1><p>Nutrición excepcional para tu gato</p>'
    const parsed = parsePartialSinglePageHtml(partial, page)
    expect(parsed?.path).toBe('design/pages/home/index.html')
    expect(parsed?.content).toContain('Purrfect')
  })

  it('prefers complete fenced block when closed', () => {
    const full =
      '```html design/pages/home/index.html\n<!DOCTYPE html><html><body><p>OK</p></body></html>\n```'
    const parsed = parsePartialSinglePageHtml(full, page)
    expect(parsed?.content).toContain('<p>OK</p>')
  })
})

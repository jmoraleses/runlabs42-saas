import { describe, expect, it } from 'vitest'
import { isDesignPreviewPlaceholderHtml } from '@/lib/design/isDesignPreviewPlaceholderHtml'

const AURORA_STUB = `<!DOCTYPE html><html><body><div class="rl42-blue-aurora"></div></body></html>`

describe('isDesignPreviewPlaceholderHtml', () => {
  it('detecta el documento aurora de carga', () => {
    expect(isDesignPreviewPlaceholderHtml(AURORA_STUB)).toBe(true)
  })

  it('no marca HTML de producto con contenido real', () => {
    const product = `<!DOCTYPE html><html><body><main><section><h1>Inicio</h1></section></main></body></html>`
    expect(isDesignPreviewPlaceholderHtml(product)).toBe(false)
  })
})

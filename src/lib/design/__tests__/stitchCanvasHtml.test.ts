import { describe, expect, it } from 'vitest'
import {
  htmlUsesTailwindUtilityClasses,
  isCanvasPreviewHtmlReady,
  isStitchStyleHtml,
  normalizeStitchTailwindHeadOrder,
} from '@/lib/design/stitchParity'

describe('canvas preview HTML readiness', () => {
  it('acepta documento Stitch con Tailwind CDN', () => {
    const html =
      '<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head>' +
      '<body class="bg-primary flex"></body></html>'
    expect(isStitchStyleHtml(html)).toBe(true)
    expect(isCanvasPreviewHtmlReady(html)).toBe(true)
  })

  it('rechaza fragmento con clases utility pero sin Tailwind en head', () => {
    const html =
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
      '<body class="bg-primary py-section-gap-lg"><main><h1>Hola</h1></main></body></html>'
    expect(htmlUsesTailwindUtilityClasses(html)).toBe(true)
    expect(isCanvasPreviewHtmlReady(html)).toBe(false)
  })

  it('pone CDN antes de tailwind-config si config va primero o hay style en medio', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://cdn.tailwindcss.com"></script>
<style>.x{color:red}</style>
<script id="tailwind-config">tailwind.config={theme:{extend:{colors:{primary:'#000'}}}}</script>
</head><body class="bg-primary"></body></html>`
    const out = normalizeStitchTailwindHeadOrder(html)
    const configIdx = out.indexOf('tailwind-config')
    const cdnIdx = out.indexOf('cdn.tailwindcss.com')
    const styleIdx = out.indexOf('<style')
    expect(cdnIdx).toBeGreaterThan(-1)
    expect(configIdx).toBeGreaterThan(cdnIdx)
    expect(styleIdx).toBeGreaterThan(configIdx)
  })

  it('acepta HTML vanilla con bloque style sustancial', () => {
    const css = 'body{margin:0;background:#fcf9f4}h1{font-size:2rem}'.repeat(8)
    const html = `<!DOCTYPE html><html><head><style>${css}</style></head><body><h1>Hola</h1></body></html>`
    expect(isCanvasPreviewHtmlReady(html)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import {
  ensureBodyShellForPreview,
  extractLargestHtmlDocumentFromModelText,
  isAcceptableOrchestrationPageHtml,
  isCompleteOrchestrationPageHtml,
  prepareOrchestrationPageHtmlForPersist,
  repairTruncatedPageHtml,
  stripLeadingNonHtmlBeforeDocument,
  truncateAtFirstClosingHtml,
} from '@/lib/design/orchestrationHtmlQuality'

const completeHtml = `<!DOCTYPE html><html><head><style>${':root{--a:#000} '.repeat(120)}</style></head><body><main><h1>Hola</h1><p>${'Contenido visible de la página de inicio. '.repeat(40)}</p></main></body></html>`

describe('isCompleteOrchestrationPageHtml', () => {
  it('rejects truncated fragments without closing html', () => {
    const truncated = completeHtml.slice(0, 80)
    expect(isCompleteOrchestrationPageHtml(truncated)).toBe(false)
  })

  it('accepts full documents with visible body', () => {
    expect(isCompleteOrchestrationPageHtml(completeHtml)).toBe(true)
  })

  it('repara HTML truncado sin cerrar html', () => {
    const truncated = completeHtml.replace(/<\/html>\s*$/i, '')
    expect(isCompleteOrchestrationPageHtml(truncated)).toBe(false)
    const repaired = repairTruncatedPageHtml(truncated)
    expect(isCompleteOrchestrationPageHtml(repaired)).toBe(true)
    expect(prepareOrchestrationPageHtmlForPersist(truncated)).toBe(repaired)
  })

  it('extrae HTML grande aunque el fence no esté cerrado', () => {
    const wrapped = `Notas del modelo:\n\`\`\`html design/site/index.html\n${completeHtml}`
    const extracted = extractLargestHtmlDocumentFromModelText(wrapped)
    expect(extracted?.length).toBeGreaterThan(2000)
    expect(isAcceptableOrchestrationPageHtml(extracted ?? '')).toBe(true)
  })

  it('acepta documentos largos con <main> sin <body> (salida típica del modelo)', () => {
    const mainOnly =
      '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>T</title>' +
      `<style>${':root{--c:#000} '.repeat(80)}</style></head><main>` +
      `<h1>Tienda</h1><p>${'Productos y ofertas. '.repeat(200)}</p>` +
      '</main></html>'
    expect(mainOnly.length).toBeGreaterThan(1200)
    expect(/<body/i.test(mainOnly)).toBe(false)
    const prepared = prepareOrchestrationPageHtmlForPersist(mainOnly)
    expect(/<body/i.test(prepared)).toBe(true)
    expect(isAcceptableOrchestrationPageHtml(mainOnly)).toBe(true)
    expect(ensureBodyShellForPreview(mainOnly).length).toBeGreaterThan(mainOnly.length)
  })

  it('envuelve fragmento <div> sin <html> en documento completo', () => {
    const fragment =
      '<div class="page">' +
      '<header><h1>Hola</h1></header>'.repeat(3) +
      '<section><p>Texto.</p></section>'.repeat(40) +
      '</div>'
    const prepared = prepareOrchestrationPageHtmlForPersist(fragment)
    expect(prepared).toMatch(/<!DOCTYPE html>/i)
    expect(prepared).toMatch(/<body[\s>]/i)
    expect(isAcceptableOrchestrationPageHtml(prepared)).toBe(true)
  })

  it('envuelve fragmento <main> sin <html> en documento completo', () => {
    const fragment = '<main><h1>Hola</h1><p>Texto.</p></main>'
    const prepared = prepareOrchestrationPageHtmlForPersist(fragment)
    expect(prepared).toMatch(/<!DOCTYPE html>/i)
    expect(prepared).toMatch(/<body[\s>]/i)
    const bigFragment =
      '<main>' + '<section><h2>X</h2><p>Y</p></section>'.repeat(80) + '</main>'
    expect(
      extractLargestHtmlDocumentFromModelText(
        '```html design/site/index.html\n' + bigFragment,
      )?.length,
    ).toBeGreaterThan(500)
  })

  it('elimina prosa y HTML duplicado tras el primer </html>', () => {
    const leaked =
      completeHtml +
      '\n\nNotas: aquí va más código.\n<div class="leak">visible</div>\n```html\n<main>basura</main>\n```'
    const prepared = prepareOrchestrationPageHtmlForPersist(leaked)
    expect(prepared).not.toContain('leak')
    expect(prepared).not.toContain('Notas:')
    expect(truncateAtFirstClosingHtml(leaked)).toBe(completeHtml)
  })

  it('quita preambulo del modelo antes del DOCTYPE', () => {
    const withIntro = 'Aquí tienes la pantalla:\n\n' + completeHtml
    expect(stripLeadingNonHtmlBeforeDocument(withIntro)).toBe(completeHtml)
  })

  it('extrae el documento cerrado sin arrastrar texto posterior', () => {
    const wrapped = `Intro\n${completeHtml}\n<div class="post-html-leak">x</div>`
    const extracted = extractLargestHtmlDocumentFromModelText(wrapped)
    expect(extracted).not.toContain('post-html-leak')
    expect(extracted?.length).toBeLessThanOrEqual(completeHtml.length + 200)
  })

  it('elimina volcado de etiquetas al final del body', () => {
    const footer = '</footer>'
    const dump = '<section><div><p>'.repeat(40)
    const withDump =
      completeHtml.replace(/<\/body>/i, `${footer}${dump}</body>`)
    const prepared = prepareOrchestrationPageHtmlForPersist(withDump)
    expect(prepared).toContain('</footer>')
    expect(prepared).not.toContain('<section><div><p><section>')
  })

  it('acepta HTML denso con poco texto visible (layout visual)', () => {
    const visual =
      '<!DOCTYPE html><html><head><style>' +
      '.c{display:grid}'.repeat(400) +
      '</style></head><main>' +
      '<div class="c">' +
      '<article><span class="i"></span></article>'.repeat(80) +
      '</div></main></html>'
    expect(visual.length).toBeGreaterThan(6000)
    expect(isAcceptableOrchestrationPageHtml(visual)).toBe(true)
  })

  it('no inyecta theme.css en HTML con Tailwind Stitch', () => {
    const stitchHtml =
      '<!DOCTYPE html><html><head>' +
      '<script src="https://cdn.tailwindcss.com"></script>' +
      '<script id="tailwind-config">tailwind.config={}</script>' +
      '</head><body><main><h1>Hola mundo visible en pantalla</h1>' +
      `<p>${'Texto de producto. '.repeat(30)}</p></main></body></html>`
    const designMd = '---\ncolors:\n  primary: "#ff0000"\n---\n## Brand\nX'
    const prepared = prepareOrchestrationPageHtmlForPersist(stitchHtml, designMd)
    expect(prepared).not.toContain('runlabs42-design-theme')
    expect(prepared).toContain('cdn.tailwindcss.com')
  })

  it('fusiona fontSize y fontFamily en tailwind.config desde design.md', () => {
    const stitchHtml =
      '<!DOCTYPE html><html><head>' +
      '<script src="https://cdn.tailwindcss.com"></script>' +
      '<script id="tailwind-config">tailwind.config={theme:{extend:{colors:{primary:"#000"}}}}</script>' +
      '</head><body><main><h1 class="text-headline-xl">Hola</h1>' +
      `<p>${'Texto. '.repeat(40)}</p></main></body></html>`
    const designMd = `---
colors:
  primary: '#705d00'
typography:
  headline-xl:
    fontFamily: Quicksand
    fontSize: 48px
    fontWeight: '700'
---
`
    const prepared = prepareOrchestrationPageHtmlForPersist(stitchHtml, designMd)
    expect(prepared).toContain('"fontSize"')
    expect(prepared).toContain('"headline-xl": ["48px"')
    expect(prepared).toContain('#705d00')
  })
})

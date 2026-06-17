import { describe, it, expect } from 'vitest'
import { applyDesignHtmlPatch } from '@/lib/design/applyDesignHtmlPatch'

const SAMPLE = `<!DOCTYPE html>
<html><body>
  <h1 data-sk-id="sk-title" style="color:#fff;font-size:24px">Hello</h1>
  <a data-sk-id="sk-link" href="/old">Link</a>
  <p data-sk-id="sk-p" class="lead">Body</p>
</body></html>`

const el = { skId: 'sk-title', tagName: 'h1', text: 'Hello' }

describe('applyDesignHtmlPatch', () => {
  it('updates text by previousText', () => {
    const { html, applied } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-title', property: 'text', value: 'Hola' },
      el,
      { previousText: 'Hello' },
    )
    expect(applied).toBe(true)
    expect(html).toContain('Hola')
    expect(html).not.toContain('>Hello<')
  })

  it('updates fontSize in style', () => {
    const { html, applied } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-title', property: 'fontSize', value: '32px' },
      el,
    )
    expect(applied).toBe(true)
    expect(html).toMatch(/font-size:\s*32px/i)
  })

  it('adds padding when no prior style block on element', () => {
    const { html, applied } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-p', property: 'padding', value: '1rem' },
      { skId: 'sk-p', tagName: 'p' },
    )
    expect(applied).toBe(true)
    expect(html).toMatch(/data-sk-id="sk-p"[^>]*style="[^"]*padding:\s*1rem/i)
  })

  it('updates textAlign', () => {
    const { html, applied } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-title', property: 'textAlign', value: 'center' },
      el,
    )
    expect(applied).toBe(true)
    expect(html).toMatch(/text-align:\s*center/i)
  })

  it('updates borderRadius', () => {
    const { html, applied } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-title', property: 'borderRadius', value: '8px' },
      el,
    )
    expect(applied).toBe(true)
    expect(html).toMatch(/border-radius:\s*8px/i)
  })

  it('updates href on anchor', () => {
    const { html, applied } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-link', property: 'href', value: '/new' },
      { skId: 'sk-link', tagName: 'a' },
    )
    expect(applied).toBe(true)
    expect(html).toContain('href="/new"')
  })

  it('updates className', () => {
    const { html, applied } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-p', property: 'className', value: 'muted' },
      { skId: 'sk-p', tagName: 'p' },
    )
    expect(applied).toBe(true)
    expect(html).toContain('class="muted"')
  })

  it('removes element on display none', () => {
    const { html, applied } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-p', property: 'display', value: 'none' },
      { skId: 'sk-p', tagName: 'p' },
    )
    expect(applied).toBe(true)
    expect(html).not.toContain('sk-p')
  })

  it('updates backgroundColor', () => {
    const { html, applied } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-title', property: 'backgroundColor', value: '#111' },
      el,
    )
    expect(applied).toBe(true)
    expect(html).toMatch(/background-color:\s*#111/i)
  })

  it('updates opacity', () => {
    const { html, applied } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-title', property: 'opacity', value: '0.5' },
      el,
    )
    expect(applied).toBe(true)
    expect(html).toMatch(/opacity:\s*0\.5/i)
  })

  it('updates borderWidth and borderColor', () => {
    const { html: w, applied: wOk } = applyDesignHtmlPatch(
      SAMPLE,
      { skId: 'sk-title', property: 'borderWidth', value: '2px' },
      el,
    )
    expect(wOk).toBe(true)
    expect(w).toMatch(/border-width:\s*2px/i)

    const { html: c, applied: cOk } = applyDesignHtmlPatch(
      w,
      { skId: 'sk-title', property: 'borderColor', value: '#f00' },
      el,
    )
    expect(cOk).toBe(true)
    expect(c).toMatch(/border-color:\s*#f00/i)
  })

  it('updates img src by sk-id', () => {
    const html = `<!DOCTYPE html><html><body><img data-sk-id="sk-img" src="assets/old.jpg" alt="Hero"></body></html>`
    const { html: next, applied } = applyDesignHtmlPatch(
      html,
      { skId: 'sk-img', property: 'src', value: 'assets/new.jpg' },
      { skId: 'sk-img', tagName: 'img' },
    )
    expect(applied).toBe(true)
    expect(next).toContain('src="assets/new.jpg"')
    expect(next).not.toContain('assets/old.jpg')
  })
})

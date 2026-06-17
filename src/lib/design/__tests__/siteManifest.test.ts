import { describe, expect, it } from 'vitest'
import {
  buildSiteManifest,
  detectMotionInHtml,
  extractFormsFromHtml,
  pageIdToDesignHref,
  pageIdToRoute,
  parseSiteManifest,
  SITE_MANIFEST_PATH,
} from '@/lib/design/siteManifest'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'

describe('pageIdToRoute', () => {
  it('maps home to root', () => {
    expect(pageIdToRoute('home')).toBe('/')
    expect(pageIdToDesignHref('home')).toBe('/')
  })

  it('maps other pages', () => {
    expect(pageIdToRoute('pricing')).toBe('/pricing')
    expect(pageIdToDesignHref('pricing')).toBe('/pages/pricing')
  })
})

describe('extractFormsFromHtml', () => {
  it('extracts named fields and data-form-id', () => {
    const html = `
      <form data-form-id="contact-main">
        <input type="text" name="email" required />
        <textarea name="message"></textarea>
        <button type="submit">Enviar</button>
      </form>`
    const forms = extractFormsFromHtml(html, 'contact')
    expect(forms).toHaveLength(1)
    expect(forms[0].id).toBe('contact-main')
    expect(forms[0].intent).toBe('contact')
    expect(forms[0].fields.map((f) => f.name)).toEqual(['email', 'message'])
  })
})

describe('detectMotionInHtml', () => {
  it('detects keyframes and animate classes', () => {
    expect(detectMotionInHtml('<style>@keyframes fade { }</style>')).toBe(true)
    expect(detectMotionInHtml('<div class="animate-fade-in">')).toBe(true)
    expect(detectMotionInHtml('<p>static</p>')).toBe(false)
  })
})

describe('buildSiteManifest', () => {
  it('builds pages and internal links from spec and html', () => {
    const spec = {
      version: 2,
      title: 'Test',
      summary: '',
      tokens: {},
      pages: [
        { id: 'home', name: 'Inicio', path: 'design/site/index.html' },
        { id: 'pricing', name: 'Precios', path: 'design/pages/pricing/index.html' },
      ],
    }
    const designFiles = [
      { path: DESIGN_SPEC_JSON, content: JSON.stringify(spec) },
      {
        path: 'design/site/index.html',
        content: '<nav><a href="/pages/pricing">Precios</a></nav>',
      },
      {
        path: 'design/pages/pricing/index.html',
        content:
          '<form data-form-id="newsletter"><input type="email" name="email" /></form>',
      },
    ]
    const manifest = buildSiteManifest({ designFiles, siteType: 'landing' })
    expect(manifest.pages).toHaveLength(2)
    expect(manifest.pages[0].route).toBe('/')
    expect(manifest.internalLinks.some((l) => l.toPageId === 'pricing')).toBe(true)
    expect(manifest.forms).toHaveLength(1)
    expect(manifest.forms[0].intent).toBe('newsletter')
    expect(manifest.requiresDatabase).toBe(true)
  })
})

describe('parseSiteManifest', () => {
  it('parses valid manifest', () => {
    const raw = JSON.stringify({
      version: 1,
      siteType: 'landing',
      pages: [],
      forms: [],
      internalLinks: [],
      requiresDatabase: false,
      requiresAuth: false,
      motion: false,
      envRequired: [],
    })
    expect(parseSiteManifest(raw)?.version).toBe(1)
    expect(parseSiteManifest('{')).toBeNull()
  })

  it('exports canonical path', () => {
    expect(SITE_MANIFEST_PATH).toBe('spec/site-manifest.json')
  })
})

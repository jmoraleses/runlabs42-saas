import { describe, expect, it } from 'vitest'
import { validateProjectForWebDeploy } from '@/lib/mobile/validateDeploy'
import type { SiteManifest } from '@/lib/design/siteManifest'

const nextPkg = JSON.stringify({
  name: 'site',
  scripts: { build: 'next build', dev: 'next dev' },
  dependencies: { next: '^14.0.0', react: '^18.0.0' },
})

describe('validateProjectForWebDeploy (Next.js)', () => {
  it('accepts app router entry', () => {
    const result = validateProjectForWebDeploy([
      { path: 'package.json', content: nextPkg },
      { path: 'app/layout.tsx', content: 'export default function L({ children }) { return children }' },
      { path: 'app/page.tsx', content: 'export default function P() { return null }' },
    ])
    expect(result.ok).toBe(true)
  })

  it('requires form API when manifest has forms', () => {
    const manifest: SiteManifest = {
      version: 1,
      siteType: 'landing',
      pages: [{ id: 'home', name: 'Home', route: '/', htmlPath: 'design/site/index.html', designHref: '/' }],
      forms: [{ id: 'contact', pageId: 'home', intent: 'contact', fields: [{ name: 'email', type: 'email' }] }],
      internalLinks: [],
      requiresDatabase: true,
      requiresAuth: false,
      motion: false,
      envRequired: ['POSTGRES_URL'],
    }
    const result = validateProjectForWebDeploy(
      [
        { path: 'package.json', content: nextPkg },
        { path: 'app/layout.tsx', content: 'x' },
        { path: 'app/page.tsx', content: 'x' },
      ],
      manifest,
    )
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.id === 'missing-form-api')).toBe(true)
  })
})

describe('validateProjectForWebDeploy (static / CMS)', () => {
  it('accepts preview-only deploy for shopify template', () => {
    const result = validateProjectForWebDeploy(
      [
        { path: 'preview/index.html', content: '<!DOCTYPE html><html></html>' },
        { path: 'vercel.json', content: '{}' },
        { path: 'export/shopify/theme/layout/theme.liquid', content: '{{ content }}' },
      ],
      { codeTemplate: 'shopify' },
    )
    expect(result.ok).toBe(true)
  })

  it('errors without preview html for cms', () => {
    const result = validateProjectForWebDeploy(
      [{ path: 'export/wordpress/style.css', content: '/* x */' }],
      { codeTemplate: 'wordpress' },
    )
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.id === 'missing-preview-html')).toBe(true)
  })
})

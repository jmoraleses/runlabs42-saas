import { describe, expect, it } from 'vitest'
import {
  buildStitchTailwindConfigScriptBody,
  buildTailwindThemeExtendFromDesignMd,
  designMdFromStitchTheme,
  designMdHasStitchColorTokens,
  designMdTailwindConfigHint,
  isStitchParityEnabled,
  isStitchStyleHtml,
  mergeStitchTailwindConfigFromDesignMd,
  normalizeStitchFontName,
  preferMonolithicOrchestrationHtml,
  stitchParityHtmlSystemRules,
  stitchSectionParityChecklistFromHtml,
  stitchSectionParityReviewRules,
} from '@/lib/design/stitchParity'

const POLLITOS_DESIGN_MD = `---
name: Tienda de Pollitos Amarillos
colors:
  primary: '#705d00'
  surface: '#fff8f0'
  on-surface: '#1f1b0f'
  primary-container: '#ffd700'
typography:
  headline-xl:
    fontFamily: Quicksand
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
  body-md:
    fontFamily: Quicksand
    fontSize: 16px
    fontWeight: '500'
rounded:
  DEFAULT: 0.25rem
  lg: 0.5rem
spacing:
  margin-desktop: 48px
  gutter-desktop: 24px
---
`

describe('stitchParity', () => {
  it('activa paridad por defecto en todos los modelos', () => {
    expect(isStitchParityEnabled('gemini-2.5-flash-lite')).toBe(true)
    expect(isStitchParityEnabled('gemini-2.5-flash')).toBe(true)
  })

  it('respeta DESIGN_STITCH_PARITY=0', () => {
    const prev = process.env.DESIGN_STITCH_PARITY
    process.env.DESIGN_STITCH_PARITY = '0'
    expect(isStitchParityEnabled('gemini-2.5-flash-lite')).toBe(false)
    process.env.DESIGN_STITCH_PARITY = prev
  })

  it('prefiere monolito con paridad aunque haya SSE', () => {
    expect(preferMonolithicOrchestrationHtml('gemini-2.5-flash', { send: () => {} })).toBe(true)
  })

  it('detecta HTML estilo Stitch', () => {
    expect(isStitchStyleHtml('<script src="https://cdn.tailwindcss.com"></script>')).toBe(true)
    expect(isStitchStyleHtml('<style>:root{--primary:#000}</style>')).toBe(false)
  })

  it('convierte designTheme a design.md', () => {
    const md = designMdFromStitchTheme({
      title: 'Pollitos',
      designTheme: {
        font: 'QUICKSAND',
        roundness: 'ROUND_EIGHT',
        namedColors: { primary: '#ffd700', surface: '#fff8f0' },
      },
    })
    expect(md).toContain("primary: '#ffd700'")
    expect(md).toContain('Quicksand')
    expect(md).toContain('headline-xl-mobile')
    expect(md).toContain('margin-mobile: 20px')
  })

  it('normaliza fuentes Stitch', () => {
    expect(normalizeStitchFontName('QUICKSAND')).toBe('Quicksand')
  })

  it('genera theme.extend con fontSize y fontFamily desde design.md', () => {
    const extend = buildTailwindThemeExtendFromDesignMd(POLLITOS_DESIGN_MD)
    expect(extend.colors.primary).toBe('#705d00')
    expect(extend.fontSize['headline-xl']).toContain('48px')
    expect(extend.fontFamily['headline-xl']).toEqual(['Quicksand'])
    expect(extend.spacing['margin-desktop']).toBe('48px')
    expect(extend.borderRadius.DEFAULT).toBe('0.25rem')
  })

  it('designMdTailwindConfigHint incluye darkMode y fontSize', () => {
    const hint = designMdTailwindConfigHint(POLLITOS_DESIGN_MD)
    expect(hint).toContain('darkMode: "class"')
    expect(hint).toContain('"fontSize"')
    expect(hint).toContain('"headline-xl"')
  })

  it('designMdHasStitchColorTokens exige colores hex en frontmatter', () => {
    expect(designMdHasStitchColorTokens(POLLITOS_DESIGN_MD)).toBe(true)
    expect(designMdHasStitchColorTokens('# Sin YAML\nSolo texto')).toBe(false)
    expect(
      designMdHasStitchColorTokens('---\ncolors:\n  primary: var(--foo)\n---\n'),
    ).toBe(false)
  })

  it('no reemplaza tailwind.config si design.md no trae colores', () => {
    const html =
      '<!DOCTYPE html><html><head>' +
      '<script src="https://cdn.tailwindcss.com"></script>' +
      '<script id="tailwind-config">tailwind.config={theme:{extend:{colors:{primary:"#ffd700"}}}}</script>' +
      '</head><body></body></html>'
    const minimalMd = '# Import\nSin tokens de color.\n'
    const out = mergeStitchTailwindConfigFromDesignMd(html, minimalMd)
    expect(out).toContain('#ffd700')
    expect(out).not.toContain('#705d00')
  })

  it('inyecta tailwind.config completo al persistir HTML', () => {
    const html =
      '<!DOCTYPE html><html><head>' +
      '<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>' +
      '<script id="tailwind-config">tailwind.config={theme:{extend:{colors:{primary:"#000"}}}}</script>' +
      '</head><body class="text-headline-xl"></body></html>'
    const out = mergeStitchTailwindConfigFromDesignMd(html, POLLITOS_DESIGN_MD)
    expect(out).toContain('darkMode: "class"')
    expect(out).toContain('"fontSize"')
    expect(out).toContain('#705d00')
    const cdnIdx = out.indexOf('cdn.tailwindcss.com')
    const configIdx = out.indexOf('tailwind-config')
    expect(cdnIdx).toBeGreaterThan(-1)
    expect(configIdx).toBeGreaterThan(cdnIdx)
  })

  it('reglas HTML documentan CDN antes que config', () => {
    const rules = stitchParityHtmlSystemRules()
    expect(rules).toMatch(/PRIMERO el CDN/i)
    expect(rules).toMatch(/INMEDIATAMENTE DESPUÉS.*tailwind-config/i)
  })

  it('extrae checklist de secciones desde HTML Stitch', () => {
    const html = `<!-- Hero Section --><h2>Why Families Trust Us</h2><!-- New Arrivals Section -->`
    const list = stitchSectionParityChecklistFromHtml(html)
    expect(list.some((s) => /Hero/i.test(s))).toBe(true)
    expect(list.some((s) => /Why Families/i.test(s))).toBe(true)
  })

  it('stitchSectionParityReviewRules menciona bento con referencia', () => {
    const ref = '<!-- Why Choose Us - Bento Grid Style --><h2>Benefits</h2>'
    const rules = stitchSectionParityReviewRules(ref)
    expect(rules).toContain('bento')
  })
})

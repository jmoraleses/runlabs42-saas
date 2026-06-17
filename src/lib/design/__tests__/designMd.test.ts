import { describe, expect, it } from 'vitest'
import {
  DESIGN_MD_THEME_STYLE_ID,
  designMdCssRootVariableHints,
  designMdHtmlGuidanceBlocks,
  designMdIsRichEnough,
  designMdSystemInstruction,
  envelopeFromDesignMd,
  injectDesignMdThemeIntoHtml,
  parseDesignMdFromModelText,
  parseYamlFrontmatter,
  resolveDesignMdFromModel,
} from '@/lib/design/designMd'
import { RICH_STITCH_DESIGN_MD } from '@/lib/design/__tests__/fixtures/stitchDesignMdFixture'
import type { DesignBrief } from '@/lib/design/designBrief'

const SAMPLE_DESIGN_MD = `---
name: Organic Minimalist Botanical
colors:
  primary: '#061b0e'
  secondary: '#51634f'
  tertiary: '#300b00'
  background: '#fcf9f4'
  on-surface: '#1c1c19'
typography:
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
  body-md:
    fontFamily: Montserrat
    fontSize: 16px
rounded:
  DEFAULT: 0.5rem
spacing:
  unit: 8px
---

## Brand & Style

Organic minimalism for urban gardeners.
`

describe('designMd', () => {
  it('parsea frontmatter YAML y envelope de tokens', () => {
    const fm = parseYamlFrontmatter(SAMPLE_DESIGN_MD)
    expect(fm?.name).toBe('Organic Minimalist Botanical')
    expect((fm?.colors as Record<string, string>)?.primary).toBe('#061b0e')

    const envelope = envelopeFromDesignMd(SAMPLE_DESIGN_MD)
    expect(envelope.brand?.concept).toBe('Organic Minimalist Botanical')
    expect(envelope.tokens?.colors?.primary).toBe('#061b0e')
    expect(envelope.tokens?.colors?.text).toBe('#1c1c19')
    expect(envelope.tokens?.typography?.heading).toContain('Playfair Display')
    expect(envelope.tokens?.typography?.body).toContain('Montserrat')
    expect(envelope.tokens?.ui?.borderRadius).toBe('0.5rem')
    expect(envelope.tokens?.ui?.layoutStyle).toBe('organic')
  })

  it('extrae design.md desde bloque markdown del modelo', () => {
    const text = [
      'Aquí va el sistema:',
      '```markdown spec/design.md',
      SAMPLE_DESIGN_MD,
      '```',
    ].join('\n')
    const parsed = parseDesignMdFromModelText(text)
    expect(parsed).toContain('Organic Minimalist Botanical')
    expect(parsed).toContain('## Brand & Style')
  })

  it('extrae frontmatter aunque haya texto antes del bloque', () => {
    const text = `Aquí tienes el sistema de diseño:\n\n${SAMPLE_DESIGN_MD}`
    const parsed = parseDesignMdFromModelText(text)
    expect(parsed).toContain('Organic Minimalist Botanical')
  })

  it('acepta fence markdown genérico con YAML', () => {
    const text = ['```markdown', SAMPLE_DESIGN_MD, '```'].join('\n')
    expect(parseDesignMdFromModelText(text)).toContain('headline-lg')
  })

  it('acepta frontmatter sin cierre --- si hay colores parseables', () => {
    const md = `---
name: Truncated Style
colors:
  primary: '#854D27'
  secondary: '#0A3A1B'
`
    const resolved = resolveDesignMdFromModel(md, { prompt: 'botanical shop' })
    expect(resolved.source).toBe('model-md')
    expect(resolved.envelope.tokens?.colors?.primary).toBe('#854D27')
  })

  it('parsea comillas sin cerrar y quita fences incrustados', () => {
    const md = `---
name: Elegant Botanical Editorial
colors:
  primary: '#854D27'
  secondary: '#0A3A1B
`
    const wrapped = ['```markdown spec/design.md', md, '```'].join('\n')
    const parsed = parseDesignMdFromModelText(wrapped)
    expect(parsed).not.toContain('```markdown')
    const fm = parseYamlFrontmatter(parsed ?? '')
    expect((fm?.colors as Record<string, string>)?.secondary).toBe('#0A3A1B')
  })

  it('parsea colores YAML con comentarios inline', () => {
    const md = `---
name: Test
colors:
  primary: '#8C4F33' # tierra
  background: '#fcf9f4'
---
`
    const fm = parseYamlFrontmatter(md)
    expect((fm?.colors as Record<string, string>)?.primary).toBe('#8C4F33')
    const resolved = resolveDesignMdFromModel(
      ['```markdown spec/design.md', md, '```'].join('\n'),
      { prompt: 'test' },
    )
    expect(resolved.source).toBe('model-md')
  })

  it('designMdIsRichEnough valida documento estilo Stitch', () => {
    expect(designMdIsRichEnough(RICH_STITCH_DESIGN_MD)).toBe(true)
    expect(designMdIsRichEnough(SAMPLE_DESIGN_MD)).toBe(false)
  })

  it('fallback desde brief genera paleta M3 y secciones narrativas', () => {
    const resolved = resolveDesignMdFromModel('texto inválido', {
      prompt: 'Tienda de plantas urbanas',
      siteType: 'ecommerce',
      brandTone: 'orgánico premium',
    })
    expect(resolved.source).toBe('brief-fallback')
    expect(resolved.designMd).toContain('surface-container')
    expect(resolved.designMd).toContain('## Elevation & Depth')
    expect(resolved.designMd).toContain('## Components')
    expect(designMdIsRichEnough(resolved.designMd)).toBe(true)
  })

  it('resolveDesignMdFromModel usa plantilla del brief si el modelo no parsea', () => {
    const brief: DesignBrief = {
      prompt: 'Tienda de plantas',
      siteType: 'ecommerce',
      brandTone: 'orgánico',
    }
    const resolved = resolveDesignMdFromModel(
      'Lo siento, no puedo generar el archivo en este formato.',
      brief,
    )
    expect(resolved.source).toBe('brief-fallback')
    expect(resolved.designMd).toContain('---')
    expect(resolved.envelope.tokens?.colors?.primary).toBeTruthy()
    expect(parseYamlFrontmatter(resolved.designMd)?.name).toBeTruthy()
  })

  it('designMdHtmlGuidanceBlocks refuerza design.md en pasos HTML (vanilla)', () => {
    const prev = process.env.DESIGN_STITCH_PARITY
    process.env.DESIGN_STITCH_PARITY = '0'
    const blocks = designMdHtmlGuidanceBlocks(SAMPLE_DESIGN_MD, 'shell')
    const joined = blocks.join('\n')
    expect(joined).toContain('FUENTE DE VERDAD')
    expect(joined).toContain('Organic Minimalist Botanical')
    expect(joined).toContain(':root')
    const css = designMdCssRootVariableHints(SAMPLE_DESIGN_MD)
    expect(css).toContain('--color-primary')
    expect(css).toContain('#061b0e')
    process.env.DESIGN_STITCH_PARITY = prev
  })

  it('designMdHtmlGuidanceBlocks usa Tailwind con paridad Stitch', () => {
    const blocks = designMdHtmlGuidanceBlocks(SAMPLE_DESIGN_MD, 'full')
    const joined = blocks.join('\n')
    expect(joined).toContain('tailwind')
    expect(joined).toContain('cdn.tailwindcss.com')
  })

  it('designMdSystemInstruction no fija paleta ni tipografía de plantilla', () => {
    const withRef = designMdSystemInstruction(true)
    const withoutRef = designMdSystemInstruction(false)
    for (const instr of [withRef, withoutRef]) {
      expect(instr).toContain("primary: '#??????'")
      expect(instr).not.toMatch(/background: '#fcf9f4'/)
      expect(instr).not.toContain('Organic Minimalist Botanical')
      expect(instr).not.toContain('Playfair Display')
    }
    expect(withRef).toContain('IMAGEN ADJUNTA')
    expect(withoutRef).toContain('BRIEF = fuente de verdad')
  })

  it('fallback ecommerce tech no reutiliza verde botánico por defecto', () => {
    const resolved = resolveDesignMdFromModel('texto inválido', {
      prompt: 'Tienda de gadgets azul moderna',
      siteType: 'ecommerce',
      brandTone: 'moderno tech',
    })
    expect(resolved.source).toBe('brief-fallback')
    expect(resolved.envelope.tokens?.colors?.primary).not.toBe('#061b0e')
    expect(resolved.envelope.tokens?.typography?.heading).not.toBe('Playfair Display')
  })

  it('injectDesignMdThemeIntoHtml inyecta fuentes y variables en el head', () => {
    const bare = `<!DOCTYPE html><html><head><title>T</title></head><body><h1>Hola</h1></body></html>`
    const out = injectDesignMdThemeIntoHtml(bare, SAMPLE_DESIGN_MD)
    expect(out).toContain(DESIGN_MD_THEME_STYLE_ID)
    expect(out).toContain('fonts.googleapis.com')
    expect(out).toContain('Playfair Display')
    expect(out).toContain('--color-primary')
    expect(out).toContain('#061b0e')
  })
})

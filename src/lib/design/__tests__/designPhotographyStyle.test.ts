import { describe, expect, it } from 'vitest'
import {
  augmentDesignAssetPrompt,
  extractPhotographyStyleFromDesignMd,
  photographyStyleFromBrief,
  resolvePhotographyStyle,
} from '@/lib/design/designPhotographyStyle'
import type { DesignBrief } from '@/lib/design/designBrief'

describe('photographyStyleFromBrief', () => {
  it('usa estilo editorial orgánico para marcas botánicas', () => {
    const style = photographyStyleFromBrief({
      prompt: 'plant shop',
      siteType: 'ecommerce',
      brandTone: 'organic minimalist botanical',
    })
    expect(style).toMatch(/botanical|editorial|cream|forest-green/i)
  })
})

describe('extractPhotographyStyleFromDesignMd', () => {
  it('lee la sección Photography & Imagery', () => {
    const md = `---
colors:
  primary: '#000'
---

## Photography & Imagery

Soft studio light on warm cream backgrounds. All product shots from one session.

## Components
Buttons.`
    expect(extractPhotographyStyleFromDesignMd(md)).toContain('Soft studio light')
  })
})

describe('augmentDesignAssetPrompt', () => {
  it('prefija el sujeto sin duplicar si ya incluye el estilo', () => {
    const style = 'Editorial botanical product photography'
    const once = augmentDesignAssetPrompt('Golden barrel cactus in ceramic pot', style)
    expect(once).toContain(style)
    expect(once).toContain('Golden barrel cactus')
    const twice = augmentDesignAssetPrompt(once, style)
    expect(twice).toBe(once)
  })
})

describe('resolvePhotographyStyle', () => {
  it('prioriza design.md sobre brief', () => {
    const md = `---\n---\n\n## Photography & Imagery\n\nMoody dark green studio backgrounds with soft side light; same session for all products.\n`
    const brief: DesignBrief = { prompt: 'x', brandTone: 'bright outdoor' }
    expect(resolvePhotographyStyle({ designMd: md, brief })).toContain('Moody dark green')
  })
})

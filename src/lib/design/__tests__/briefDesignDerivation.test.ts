import { describe, expect, it } from 'vitest'
import {
  extractHexFromBrief,
  seedColorFromBrief,
  typographyForBrief,
} from '@/lib/design/briefDesignDerivation'
import { m3PaletteFromBrief } from '@/lib/design/stitchDesignMdPalette'
import type { DesignBrief } from '@/lib/design/designBrief'

describe('briefDesignDerivation', () => {
  it('extrae hex explícito del prompt', () => {
    const brief: DesignBrief = {
      prompt: 'Marca Pollitos Amarillos con acento #ffd700 y fondo crema',
    }
    expect(extractHexFromBrief(brief)).toBe('#ffd700')
    expect(seedColorFromBrief(brief)).toBe('#ffd700')
  })

  it('usa Quicksand para brief infantil sin forzar Playfair', () => {
    const brief: DesignBrief = {
      prompt: 'Tienda de pollitos amarillos mascotas, tipografía Quicksand, tono juguetón',
      siteType: 'ecommerce',
    }
    const typo = typographyForBrief(brief)
    expect(typo.heading).toBe('Quicksand')
    expect(typo.body).toBe('Nunito')
  })

  it('ecommerce genérico no usa paleta orgánica fija #061b0e', () => {
    const brief: DesignBrief = {
      prompt: 'Tienda online de electrónica moderna azul tech',
      siteType: 'ecommerce',
      brandTone: 'moderno tech',
    }
    const palette = m3PaletteFromBrief(brief)
    expect(palette.primary).not.toBe('#061b0e')
    expect(palette.background).not.toBe('#fcf9f4')
  })

  it('genera paleta válida con tono orgánico', () => {
    const brief: DesignBrief = {
      prompt: 'Tienda de plantas',
      siteType: 'ecommerce',
      brandTone: 'orgánico premium',
    }
    const palette = m3PaletteFromBrief(brief)
    expect(palette.primary).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(palette.surface).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

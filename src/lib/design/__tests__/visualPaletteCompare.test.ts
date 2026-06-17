import { describe, expect, it } from 'vitest'
import {
  collectReferencePalette,
  colorDistanceRgb,
  designMdPrimaryDeviatesFromProfile,
  htmlProminentColorsDeviatesFromProfile,
} from '@/lib/design/visualPaletteCompare'

describe('visualPaletteCompare', () => {
  it('colorDistanceRgb distingue colores distintos', () => {
    expect(colorDistanceRgb('#f5f3ef', '#2563eb')).toBeGreaterThan(100)
    expect(colorDistanceRgb('#5c7a5c', '#5c7a5c')).toBe(0)
  })

  it('collectReferencePalette une dominantColors y colorRoles', () => {
    const palette = collectReferencePalette({
      dominantColors: ['#f5f3ef'],
      colorRoles: { ctaPrimary: '#5c7a5c' },
    })
    expect(palette).toContain('#f5f3ef')
    expect(palette).toContain('#5c7a5c')
  })

  it('htmlProminentColorsDeviatesFromProfile detecta hex cromáticos fuera de paleta', () => {
    const { deviates } = htmlProminentColorsDeviatesFromProfile(
      '<button style="background:#2563eb">X</button><div style="color:#1d4ed8">Y</div>',
      { dominantColors: ['#5c7a5c', '#f5f3ef'] },
    )
    expect(deviates).toBe(true)
  })

  it('no escanea hex dentro de bloques style embebidos', () => {
    const { deviates } = htmlProminentColorsDeviatesFromProfile(
      `<style>:root{--x:#690005;--y:#ffb4ab}</style><p>Hola</p>`,
      { dominantColors: ['#f04e8e'] },
    )
    expect(deviates).toBe(false)
  })

  it('htmlProminentColorsDeviatesFromProfile ignora grises y tokens del theme', () => {
    const designMd = `---
colors:
  primary: '#e93b81'
  error: '#ba1a1a'
  on-surface-variant: '#707070'
---
`
    const { deviates } = htmlProminentColorsDeviatesFromProfile(
      `<button class="bg-primary text-on-primary">CTA</button>
       <p style="color:#707070">muted</p>
       <span style="color:#ba1a1a">error</span>`,
      { dominantColors: ['#1a2024', '#e93b81', '#ffffff', '#50c2c2'] },
      { designMd },
    )
    expect(deviates).toBe(false)
  })

  it('designMdPrimaryDeviatesFromProfile compara con captura', () => {
    const md = `---
colors:
  primary: '#2563eb'
---
`
    expect(
      designMdPrimaryDeviatesFromProfile(md, { dominantColors: ['#5c7a5c'] }),
    ).toBe(true)
  })
})

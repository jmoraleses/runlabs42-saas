import { describe, expect, it } from 'vitest'
import { m3PaletteFromSeed } from '@/lib/design/themeTokens'
import {
  visualLanguageBrandSwatches,
  visualLanguageDisplayHex,
  visualLanguageUiColors,
} from '@/lib/design/visualLanguagePalette'

const TEST_PALETTE = m3PaletteFromSeed('#2d5a3d')

describe('visualLanguagePalette', () => {
  it('usa primary-container para la muestra Primary (estilo Stitch)', () => {
    const hex = visualLanguageDisplayHex(TEST_PALETTE, 'primary')
    expect(hex).toBeTruthy()
    expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('usa background para neutral', () => {
    const hex = visualLanguageDisplayHex(TEST_PALETTE, 'neutral')
    expect(hex).toBeTruthy()
    expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('genera 4 swatches de marca con escala de 10 tonos', () => {
    const swatches = visualLanguageBrandSwatches(TEST_PALETTE)
    expect(swatches).toHaveLength(4)
    expect(swatches[0]?.role).toBe('primary')
    expect(swatches[0]?.scale).toHaveLength(10)
  })

  it('expone colores de UI para botones', () => {
    const ui = visualLanguageUiColors(TEST_PALETTE)
    expect(ui.primaryBtn).toBeTruthy()
    expect(ui.onPrimaryBtn).toBe('#ffffff')
  })
})

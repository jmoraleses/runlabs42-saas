import { describe, expect, it } from 'vitest'
import {
  ensureDesignTokens,
  paletteFromSeed,
  parseTokensJson,
  toneScaleFromHex,
} from '@/lib/design/themeTokens'

describe('themeTokens', () => {
  it('generates a full palette from seed', () => {
    const colors = paletteFromSeed('#1978e5', 'light')
    expect(colors.primary).toBe('#1978e5')
    expect(colors.secondary).toMatch(/^#[0-9a-f]{6}$/)
    expect(colors.tertiary).toMatch(/^#[0-9a-f]{6}$/)
    expect(colors.background).toBe('#fafaf9')
  })

  it('ensures missing roles without dropping custom primary', () => {
    const tokens = ensureDesignTokens({
      colors: { primary: '#ffcc00' },
      colorMode: 'light',
    })
    expect(tokens.colors?.primary).toBe('#ffcc00')
    expect(tokens.colors?.secondary).toBeTruthy()
    expect(tokens.colors?.seed).toBe('#ffcc00')
  })

  it('builds a tonal scale from a seed hex', () => {
    const scale = toneScaleFromHex('#ffd700', 10)
    expect(scale).toHaveLength(10)
    expect(scale[0]).toMatch(/^#[0-9a-f]{6}$/)
    expect(scale[9]).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('parses tokens JSON from model output', () => {
    const parsed = parseTokensJson(
      'Here:\n{"colors":{"primary":"#112233","secondary":"#445566","tertiary":"#778899","neutral":"#aabbbb","background":"#fff","text":"#111","seed":"#112233"},"fonts":{"body":"Inter"},"colorMode":"dark"}',
    )
    expect(parsed?.colors?.primary).toBe('#112233')
    expect(parsed?.colorMode).toBe('dark')
  })
})

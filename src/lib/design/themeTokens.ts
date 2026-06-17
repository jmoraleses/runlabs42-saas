import type { DesignTokens } from '@/lib/design/types'

export type ColorMode = 'light' | 'dark'

export const PALETTE_COLOR_KEYS = [
  'primary',
  'secondary',
  'tertiary',
  'neutral',
  'background',
  'text',
  'surface',
  'border',
] as const

export type PaletteColorKey = (typeof PALETTE_COLOR_KEYS)[number]

const HEX_RE = /^#?([0-9a-f]{6})$/i

export function normalizeHex(hex: string, fallback = '#3b82f6'): string {
  const m = String(hex).trim().match(HEX_RE)
  if (!m) return fallback
  return `#${m[1]!.toLowerCase()}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360
  s /= 100
  l /= 100
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  }
}

export function shiftHue(hex: string, degrees: number, satMul = 1, lightMul = 1): string {
  const { r, g, b } = hexToRgb(hex)
  const { h, s, l } = rgbToHsl(r, g, b)
  const rgb = hslToRgb((h + degrees + 360) % 360, Math.min(100, s * satMul), Math.min(100, l * lightMul))
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

/** Escala tonal (claro → oscuro) para mostrar en Visual Language. */
export function toneScaleFromHex(hex: string, steps = 10): string[] {
  const { r, g, b } = hexToRgb(hex)
  const { h, s } = rgbToHsl(r, g, b)
  if (steps <= 1) return [normalizeHex(hex)]
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    const l = 96 - t * 88
    const rgb = hslToRgb(h, Math.max(8, s), l)
    return rgbToHex(rgb.r, rgb.g, rgb.b)
  })
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrastOnColor(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? '#1a1a1a' : '#ffffff'
}

function adjustLightness(hex: string, targetLightness: number): string {
  const { r, g, b } = hexToRgb(hex)
  const { h, s } = rgbToHsl(r, g, b)
  const rgb = hslToRgb(h, Math.max(12, s), targetLightness)
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

/** Roles Material 3 completos derivados de un color semilla (para spec/design.md). */
export function m3PaletteFromSeed(seed: string): Record<string, string> {
  const primary = normalizeHex(seed)
  const onPrimary = contrastOnColor(primary)
  const primaryContainer = adjustLightness(primary, 28)
  const onPrimaryContainer = contrastOnColor(primaryContainer)
  const secondary = shiftHue(primary, 32, 0.5, 1.05)
  const onSecondary = contrastOnColor(secondary)
  const secondaryContainer = adjustLightness(secondary, 88)
  const onSecondaryContainer = adjustLightness(secondary, 22)
  const tertiary = shiftHue(primary, 165, 0.65, 1.02)
  const onTertiary = contrastOnColor(tertiary)
  const tertiaryContainer = adjustLightness(tertiary, 82)
  const onTertiaryContainer = adjustLightness(tertiary, 24)
  const surface = adjustLightness(primary, 97)
  const onSurface = adjustLightness(primary, 12)
  const surfaceContainer = adjustLightness(primary, 94)
  const outline = adjustLightness(primary, 55)

  return {
    surface,
    'surface-dim': adjustLightness(primary, 90),
    'surface-bright': surface,
    'surface-container-lowest': '#ffffff',
    'surface-container-low': adjustLightness(primary, 96),
    'surface-container': surfaceContainer,
    'surface-container-high': adjustLightness(primary, 92),
    'surface-container-highest': adjustLightness(primary, 88),
    'on-surface': onSurface,
    'on-surface-variant': adjustLightness(primary, 32),
    'inverse-surface': adjustLightness(primary, 18),
    'inverse-on-surface': adjustLightness(primary, 95),
    outline,
    'outline-variant': adjustLightness(primary, 78),
    'surface-tint': primary,
    primary,
    'on-primary': onPrimary,
    'primary-container': primaryContainer,
    'on-primary-container': onPrimaryContainer,
    'inverse-primary': adjustLightness(primary, 75),
    secondary,
    'on-secondary': onSecondary,
    'secondary-container': secondaryContainer,
    'on-secondary-container': onSecondaryContainer,
    tertiary,
    'on-tertiary': onTertiary,
    'tertiary-container': tertiaryContainer,
    'on-tertiary-container': onTertiaryContainer,
    error: '#ba1a1a',
    'on-error': '#ffffff',
    'error-container': '#ffdad6',
    'on-error-container': '#93000a',
    'primary-fixed': adjustLightness(primary, 85),
    'primary-fixed-dim': adjustLightness(primary, 72),
    'on-primary-fixed': adjustLightness(primary, 10),
    'on-primary-fixed-variant': adjustLightness(primary, 22),
    'secondary-fixed': secondaryContainer,
    'secondary-fixed-dim': adjustLightness(secondary, 75),
    'on-secondary-fixed': onSecondaryContainer,
    'on-secondary-fixed-variant': adjustLightness(secondary, 28),
    'tertiary-fixed': tertiaryContainer,
    'tertiary-fixed-dim': adjustLightness(tertiary, 72),
    'on-tertiary-fixed': onTertiaryContainer,
    'on-tertiary-fixed-variant': adjustLightness(tertiary, 28),
    background: surface,
    'on-background': onSurface,
    'surface-variant': adjustLightness(primary, 88),
  }
}

/** Genera paleta Material-like a partir del color semilla. */
export function paletteFromSeed(seed: string, mode: ColorMode = 'light'): Record<string, string> {
  const primary = normalizeHex(seed)
  const secondary = shiftHue(primary, 24, 0.55, 1.02)
  const tertiary = shiftHue(primary, 200, 0.7, 1.05)
  const neutral = shiftHue(primary, 0, 0.12, mode === 'light' ? 0.72 : 0.38)
  const background = mode === 'light' ? '#fafaf9' : '#121214'
  const surface = mode === 'light' ? '#ffffff' : '#1c1c1f'
  const text = mode === 'light' ? '#1a1a1a' : '#f4f4f5'
  const border = mode === 'light' ? '#e4e4e7' : '#3f3f46'
  return {
    primary,
    secondary,
    tertiary,
    neutral,
    background,
    text,
    surface,
    border,
  }
}

export function readColorMode(tokens?: DesignTokens): ColorMode {
  const raw = (tokens as DesignTokens & { colorMode?: string })?.colorMode
  return raw === 'dark' ? 'dark' : 'light'
}

export function readSeedColor(tokens?: DesignTokens): string {
  const colors = tokens?.colors ?? {}
  const seed = (colors as Record<string, string>).seed
  return normalizeHex(seed ?? colors.primary ?? '#3b82f6')
}

/** Completa tokens faltantes sin sobrescribir roles ya definidos. */
export function ensureDesignTokens(
  tokens: DesignTokens | undefined,
  mode?: ColorMode,
): DesignTokens {
  const colorMode = mode ?? readColorMode(tokens)
  const seed = readSeedColor(tokens)
  const generated = paletteFromSeed(seed, colorMode)
  const existing = tokens?.colors ?? {}
  const colors: Record<string, string> = { ...generated }
  for (const [key, value] of Object.entries(existing)) {
    if (value?.trim()) colors[key] = normalizeHex(value, generated[key] ?? '#888')
  }
  colors.seed = seed
  colors.primary = normalizeHex(colors.primary ?? generated.primary ?? seed)
  return {
    ...tokens,
    colorMode,
    colors,
    fonts: {
      body: 'Inter, system-ui, sans-serif',
      heading: 'Inter, system-ui, sans-serif',
      ...tokens?.fonts,
    },
  }
}

const ELEGANT_SEEDS = [
  '#2d6a4f', // verde esmeralda
  '#264653', // azul petróleo
  '#5c4033', // marrón chocolate
  '#1d3557', // azul marino profundo
  '#4a1942', // ciruela
  '#6b3f6b', // morado oscuro
  '#2b4570', // azul zafiro
  '#7b2d8b', // violeta real
  '#1b4332', // verde bosque
  '#3d405b', // gris azulado
  '#8b5e3c', // caramelo tostado
  '#2c6e49', // jade
  '#4f3422', // cuero
  '#1f4e79', // azul cobalto
  '#5a3e36', // terracota oscura
  '#0d3b2e', // verde abeto
  '#3b1f2b', // burdeos
  '#2e4057', // pizarra
  '#56423e', // moca
  '#324a5f', // acero azul
]

export function randomElegantSeed(): string {
  return ELEGANT_SEEDS[Math.floor(Math.random() * ELEGANT_SEEDS.length)]!
}

export function parseTokensJson(text: string): DesignTokens | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0]) as { tokens?: DesignTokens } & DesignTokens
    const tokens = raw.tokens ?? raw
    if (!tokens?.colors || typeof tokens.colors !== 'object') return null
    return ensureDesignTokens(tokens)
  } catch {
    return null
  }
}

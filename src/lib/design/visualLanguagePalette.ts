import { normalizeHex, toneScaleFromHex } from '@/lib/design/themeTokens'
import type { PaletteColorKey } from '@/lib/design/themeTokens'

/** Roles mostrados en el marco Visual Language (estilo Stitch). */
export const VISUAL_LANGUAGE_BRAND_KEYS: PaletteColorKey[] = [
  'primary',
  'secondary',
  'tertiary',
  'neutral',
]

/**
 * Mapea tokens Material 3 de design.md a colores de muestra del lienzo Visual Language.
 * Prioriza *-container y on-* para que el preview coincida con Stitch.
 */
export function visualLanguageDisplayHex(
  colors: Record<string, string>,
  role: PaletteColorKey,
): string {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = colors[k]
      if (typeof v === 'string' && v.trim()) return normalizeHex(v)
    }
    return undefined
  }

  switch (role) {
    case 'primary':
      return pick('primary-container', 'primary', 'surface-tint') ?? '#333333'
    case 'secondary':
      return pick('on-primary-container', 'secondary-container', 'secondary') ?? '#666666'
    case 'tertiary':
      return pick('on-tertiary-container', 'tertiary-container', 'tertiary') ?? '#888888'
    case 'neutral':
      return pick('background', 'surface-bright', 'surface', 'neutral') ?? '#f5f5f5'
    case 'background':
      return pick('background', 'surface-bright', 'surface') ?? '#f5f5f5'
    case 'text':
      return pick('on-surface', 'on-background', 'text') ?? '#1a1a1a'
    case 'surface':
      return pick('surface-container-lowest', 'surface-container-low', 'surface') ?? '#ffffff'
    case 'border':
      return pick('outline-variant', 'outline', 'border') ?? '#d0d0d0'
    default:
      return pick(role) ?? '#888888'
  }
}

export function visualLanguageBrandSwatches(colors: Record<string, string>): Array<{
  role: PaletteColorKey
  hex: string
  scale: string[]
}> {
  return VISUAL_LANGUAGE_BRAND_KEYS.map((role) => {
    const hex = visualLanguageDisplayHex(colors, role)
    return { role, hex, scale: toneScaleFromHex(hex, 10) }
  })
}

/** Colores de UI del marco (botones, nav, iconos) derivados del YAML de design.md. */
export function visualLanguageUiColors(colors: Record<string, string>) {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = colors[k]
      if (typeof v === 'string' && v.trim()) return normalizeHex(v)
    }
    return undefined
  }
  return {
    canvasBg: pick('background', 'surface-bright', 'surface') ?? '#f5f5f5',
    onSurface: pick('on-surface', 'on-background', 'text') ?? '#1a1a1a',
    primaryBtn: pick('primary-container', 'primary') ?? '#333333',
    onPrimaryBtn: pick('on-primary', 'on-primary-container') ?? '#ffffff',
    secondaryBtn: pick('surface-container-high', 'surface-container', 'secondary-container') ?? '#e8e8e8',
    invertedBg: pick('inverse-surface', 'on-surface') ?? '#1a1a1a',
    invertedFg: pick('inverse-on-surface', 'background', 'surface') ?? '#f5f5f5',
    outline: pick('outline', 'outline-variant') ?? '#aaaaaa',
    surface: pick('surface-container-lowest', 'surface-container-low', 'surface') ?? '#ffffff',
    error: pick('error', 'on-error-container') ?? '#ba1a1a',
    iconPrimary: pick('primary-container', 'primary') ?? '#333333',
    iconSecondary: pick('on-primary-container', 'secondary-container', 'secondary') ?? '#666666',
    iconTertiary: pick('on-tertiary-container', 'tertiary-container', 'tertiary') ?? '#888888',
    iconNeutral: pick('tertiary', 'inverse-surface') ?? '#444444',
  }
}

import type { VisualBriefInference } from '@/lib/design/visualBriefInference'
import type { VisualColorRoles } from '@/lib/design/visualColorRoles'
import { parseYamlFrontmatter } from '@/lib/design/designMd'

const HEX_RE = /#([0-9a-fA-F]{6})\b/g

/** Distancia euclídea RGB (0–441). */
export function colorDistanceRgb(hexA: string, hexB: string): number {
  const a = hexA.replace('#', '')
  const b = hexB.replace('#', '')
  if (a.length !== 6 || b.length !== 6) return Infinity
  const dr = parseInt(a.slice(0, 2), 16) - parseInt(b.slice(0, 2), 16)
  const dg = parseInt(a.slice(2, 4), 16) - parseInt(b.slice(2, 4), 16)
  const db = parseInt(a.slice(4, 6), 16) - parseInt(b.slice(4, 6), 16)
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function normalizeHex(value: string): string | undefined {
  const raw = value.trim().toLowerCase()
  if (!raw) return undefined
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  return /^#[0-9a-f]{6}$/.test(withHash) ? withHash : undefined
}

/** Paleta de referencia extraída del perfil de auditoría (sin valores fijos del sistema). */
export function collectReferencePalette(
  profile: Pick<VisualBriefInference, 'dominantColors' | 'colorRoles'>,
  designMd?: string,
): string[] {
  const set = new Set<string>()
  for (const c of profile.dominantColors ?? []) {
    const n = normalizeHex(c)
    if (n) set.add(n)
  }
  const roles = profile.colorRoles
  if (roles) {
    for (const v of Object.values(roles)) {
      const n = typeof v === 'string' ? normalizeHex(v) : undefined
      if (n) set.add(n)
    }
  }
  const mdPrimary = designMd ? primaryFromDesignMd(designMd) : undefined
  if (mdPrimary) set.add(mdPrimary)
  return [...set]
}

/** Quita CSS embebido del theme M3 (docenas de hex derivados que no están en dominantColors). */
export function htmlWithoutEmbeddedStyles(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
}

export function extractHexColorsFromHtml(html: string): string[] {
  const found = new Set<string>()
  for (const m of htmlWithoutEmbeddedStyles(html).matchAll(HEX_RE)) {
    const n = normalizeHex(`#${m[1]}`)
    if (n) found.add(n)
  }
  return [...found]
}

function isNearAnyReference(hex: string, reference: string[], maxDistance: number): boolean {
  return reference.some((ref) => colorDistanceRgb(hex, ref) <= maxDistance)
}

function hexSaturation(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === 0) return 0
  return (max - min) / max
}

/** Grises y neutros del theme (outline, on-surface-variant) no deben disparar rechazo. */
function isNeutralOrMutedHex(hex: string): boolean {
  if (hexSaturation(hex) < 0.2) return true
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  return spread < 28
}

function collectColorsFromDesignMd(designMd: string): string[] {
  const yaml = parseYamlFrontmatter(designMd)
  const colors = yaml?.colors
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) return []
  const out: string[] = []
  for (const value of Object.values(colors as Record<string, unknown>)) {
    const n = normalizeHex(String(value))
    if (n) out.push(n)
  }
  return out
}

/** El HTML declara tokens M3 del theme (no solo hex sueltos). */
export function htmlUsesThemeColorTokens(html: string): boolean {
  return /\bbg-primary\b|\btext-primary\b|\bbg-secondary\b|\btext-on-primary\b|\bbg-surface\b|\btext-on-surface\b/i.test(
    html,
  )
}

/** Hex inline en markup (no en <style>) lejos de la paleta. Con tokens M3 no aplica. */
export function htmlProminentColorsDeviatesFromProfile(
  html: string,
  profile: Pick<VisualBriefInference, 'dominantColors' | 'colorRoles'>,
  opts?: { maxDistance?: number; minOffPalette?: number; designMd?: string },
): { deviates: boolean; offPalette: string[] } {
  const reference = collectReferencePalette(profile, opts?.designMd)
  if (reference.length === 0) return { deviates: false, offPalette: [] }

  // El theme CSS viene de design.md alineado al audit; validar solo markup suelto.
  if (htmlUsesThemeColorTokens(html)) {
    return { deviates: false, offPalette: [] }
  }

  if (opts?.designMd) {
    for (const c of collectColorsFromDesignMd(opts.designMd)) {
      if (!reference.includes(c)) reference.push(c)
    }
  }

  const maxDistance = opts?.maxDistance ?? 95
  const minOffPalette = opts?.minOffPalette ?? 2

  const htmlColors = extractHexColorsFromHtml(html)
  const offPalette = htmlColors.filter((hex) => {
    if (isNeutralOrMutedHex(hex)) return false
    return !isNearAnyReference(hex, reference, maxDistance)
  })

  return {
    deviates: offPalette.length >= minOffPalette,
    offPalette,
  }
}

export function primaryFromDesignMd(designMd: string): string | undefined {
  const yaml = parseYamlFrontmatter(designMd)
  const colors = yaml?.colors
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) return undefined
  return normalizeHex(String((colors as Record<string, unknown>).primary ?? ''))
}

/** primary en design.md no está cerca de ningún color de la captura. */
export function designMdPrimaryDeviatesFromProfile(
  designMd: string,
  profile: Pick<VisualBriefInference, 'dominantColors' | 'colorRoles'>,
  maxDistance = 85,
): boolean {
  const primary = primaryFromDesignMd(designMd)
  const reference = collectReferencePalette(profile)
  if (!primary || reference.length === 0) return false
  return !isNearAnyReference(primary, reference, maxDistance)
}

/** El HTML usa clases de color Tailwind arbitrarias en lugar de tokens del theme. */
export function htmlUsesArbitraryTailwindChromaticClasses(html: string): boolean {
  if (htmlUsesThemeColorTokens(html)) return false
  return /\b(?:bg|text|border|from|to)-(?:red|blue|sky|indigo|violet|purple|fuchsia|pink|rose|orange|amber|yellow|lime|green|emerald|teal|cyan)-(?:[1-9]00|50)\b/i.test(
    html,
  )
}

export function formatPaletteMismatchReason(
  profile: Pick<VisualBriefInference, 'dominantColors' | 'colorRoles'>,
  offPalette: string[],
): string {
  const ref = collectReferencePalette(profile).join(', ')
  const bad = offPalette.slice(0, 4).join(', ')
  return `Colores en HTML (${bad}) no coinciden con la paleta de la captura (${ref}). Usa bg-primary, text-primary y tokens del design.md.`
}

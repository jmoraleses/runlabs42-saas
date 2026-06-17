import 'server-only'

import type { VisualBriefInference } from '@/lib/design/visualBriefInference'

/** Colores semánticos observados en la captura (no solo una lista plana). */
export type VisualColorRoles = {
  /** Fondo general de la página. */
  pageBackground?: string
  /** Botones primarios (p. ej. "Añadir", "Comenzar gratis"). */
  ctaPrimary?: string
  /** Acento en titular (ej. verde claro en palabras destacadas). */
  accentHighlight?: string
  /** Fondo suave de bandas CTA secundarias. */
  heroMuted?: string
  /** Texto principal sobre fondo claro. */
  textPrimary?: string
  /** Texto secundario / muted. */
  textMuted?: string
  /** Etiqueta "PREMIUM" o similar verde. */
  badgePremium?: string
  /** Fondo de etiqueta secundaria (p. ej. "NUEVO"). */
  badgeNew?: string
  /** Fondo de etiqueta secundaria (p. ej. "TOP VENTAS"). */
  badgeTopSales?: string
  /** Banner promocional sidebar (fondo oscuro). */
  promoBannerBg?: string
  /** CTA del banner promocional. */
  promoBannerCta?: string
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function normalizeHex(value: unknown): string | undefined {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  return HEX_RE.test(withHash) ? withHash.toLowerCase() : undefined
}

export function parseVisualColorRoles(raw: unknown): VisualColorRoles | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const roles: VisualColorRoles = {
    pageBackground: normalizeHex(o.pageBackground ?? o.background),
    ctaPrimary: normalizeHex(o.ctaPrimary ?? o.primary ?? o.cta),
    accentHighlight: normalizeHex(o.accentHighlight ?? o.accent ?? o.highlight),
    heroMuted: normalizeHex(o.heroMuted ?? o.ctaBandBg ?? o.mutedBand),
    textPrimary: normalizeHex(o.textPrimary ?? o.onSurface),
    textMuted: normalizeHex(o.textMuted ?? o.onSurfaceVariant),
    badgePremium: normalizeHex(o.badgePremium ?? o.premium),
    badgeNew: normalizeHex(o.badgeNew ?? o.badgeNuevo ?? o.new),
    badgeTopSales: normalizeHex(o.badgeTopSales ?? o.badgeTop ?? o.topSales),
    promoBannerBg: normalizeHex(o.promoBannerBg ?? o.promoBg),
    promoBannerCta: normalizeHex(o.promoBannerCta ?? o.promoCta),
  }
  const hasAny = Object.values(roles).some(Boolean)
  return hasAny ? roles : undefined
}

function hexRelativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Si no hay colorRoles, infiere primary/background desde dominantColors por luminancia. */
export function applyDominantColorsFallbackToDesignMd(
  designMd: string,
  dominantColors: string[],
): string {
  const hexes = dominantColors
    .map((c) => normalizeHex(c))
    .filter((c): c is string => Boolean(c))
  if (hexes.length === 0) return designMd

  const sorted = [...hexes].sort((a, b) => hexRelativeLuminance(a) - hexRelativeLuminance(b))
  const background = sorted[sorted.length - 1]!
  const primary = sorted[0]!

  let out = designMd
  out = replaceYamlColorKey(out, 'background', background)
  out = replaceYamlColorKey(out, 'surface', background)
  out = replaceYamlColorKey(out, 'primary', primary)
  if (sorted.length >= 2) {
    out = replaceYamlColorKey(out, 'secondary', sorted[Math.floor(sorted.length / 2)]!)
  }
  return out
}

/** Bloque obligatorio para pasos colors-* de design.md. */
export function visualReferenceColorRolesBlock(roles: VisualColorRoles): string {
  const lines = [
    '## Roles de color de la captura (OBLIGATORIO en YAML — hex exactos)',
    'Mapea los roles Material 3 así (no intercambies secondary/tertiary):',
  ]
  if (roles.pageBackground) {
    lines.push(`- background + surface-container-* (fondo página): derivar de ${roles.pageBackground}`)
  }
  if (roles.ctaPrimary) {
    lines.push(`- primary + primary-container: ${roles.ctaPrimary} (botones CTA de la captura)`)
  }
  if (roles.accentHighlight) {
    lines.push(`- tertiary o primary-container para acentos en titular: ${roles.accentHighlight}`)
  }
  if (roles.heroMuted) {
    lines.push(`- secondary-container / bandas CTA suaves: ${roles.heroMuted}`)
  }
  if (roles.badgeNew) {
    lines.push(`- tertiary + tertiary-container: ${roles.badgeNew} (etiquetas observadas en captura)`)
  }
  if (roles.badgeTopSales) {
    lines.push(`- secondary + secondary-container: ${roles.badgeTopSales} (etiquetas observadas en captura)`)
  }
  if (roles.badgePremium && roles.badgePremium !== roles.ctaPrimary) {
    lines.push(`- badge PREMIUM: ${roles.badgePremium}`)
  }
  if (roles.textPrimary) lines.push(`- on-surface / on-background: ${roles.textPrimary}`)
  if (roles.textMuted) lines.push(`- on-surface-variant / outline: ${roles.textMuted}`)
  if (roles.promoBannerBg) lines.push(`- Banner promo: fondo ~${roles.promoBannerBg}`)
  if (roles.promoBannerCta) lines.push(`- CTA banner promo: ${roles.promoBannerCta}`)
  lines.push('- Los hex del YAML deben coincidir con la captura; no uses colores por defecto del brief.')
  return lines.join('\n')
}

function replaceYamlColorKey(designMd: string, yamlKey: string, hex: string): string {
  const escaped = yamlKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `^(\\s{2}${escaped}:\\s*)(['"]?)(#[0-9a-fA-F]{6}|[^\\n'"]+)(['"]?)`,
    'm',
  )
  return designMd.replace(re, `$1'${hex}'`)
}

/** Ajusta primary/secondary/tertiary/background del frontmatter según auditoría visual. */
export function applyVisualColorRolesToDesignMd(
  designMd: string,
  roles: VisualColorRoles,
): string {
  let out = designMd
  if (roles.pageBackground) {
    out = replaceYamlColorKey(out, 'background', roles.pageBackground)
    out = replaceYamlColorKey(out, 'surface', roles.pageBackground)
  }
  if (roles.ctaPrimary) {
    out = replaceYamlColorKey(out, 'primary', roles.ctaPrimary)
  }
  if (roles.accentHighlight) {
    out = replaceYamlColorKey(out, 'tertiary', roles.accentHighlight)
  }
  if (roles.heroMuted) {
    out = replaceYamlColorKey(out, 'secondary', roles.heroMuted)
  }
  if (roles.badgeTopSales) {
    out = replaceYamlColorKey(out, 'secondary', roles.badgeTopSales)
  }
  if (roles.badgeNew) {
    out = replaceYamlColorKey(out, 'tertiary', roles.badgeNew)
  }
  if (roles.textPrimary) {
    out = replaceYamlColorKey(out, 'on-surface', roles.textPrimary)
    out = replaceYamlColorKey(out, 'on-background', roles.textPrimary)
  }
  if (roles.textMuted) {
    out = replaceYamlColorKey(out, 'on-surface-variant', roles.textMuted)
  }
  return out
}

/** Aplica colorRoles y, si faltan roles clave, fallback desde dominantColors. */
export function snapVisualColorsToDesignMd(
  designMd: string,
  profile: Pick<VisualBriefInference, 'colorRoles' | 'dominantColors'>,
): string {
  let out = designMd
  if (profile.colorRoles) {
    out = applyVisualColorRolesToDesignMd(out, profile.colorRoles)
    if (!profile.colorRoles.ctaPrimary && profile.dominantColors?.length) {
      out = applyDominantColorsFallbackToDesignMd(out, profile.dominantColors)
    }
  } else if (profile.dominantColors?.length) {
    out = applyDominantColorsFallbackToDesignMd(out, profile.dominantColors)
  }
  return out
}

export function visualReferenceBadgeHtmlBlock(roles: VisualColorRoles): string {
  return [
    '## Badges y etiquetas en HTML (mapeo desde design.md)',
    roles.badgePremium || roles.ctaPrimary
      ? `- "PREMIUM": bg-primary o bg-primary-container con texto on-primary`
      : '',
    roles.badgeNew ? `- Etiquetas con badgeNew: bg-tertiary text-on-tertiary` : '',
    roles.badgeTopSales ? `- Etiquetas con badgeTopSales: bg-secondary text-on-secondary` : '',
    'Usa solo tokens del theme (bg-primary, bg-secondary, bg-tertiary); no clases Tailwind de color arbitrarias.',
    roles.ctaPrimary
      ? `- Botones CTA: bg-primary text-on-primary (hex ${roles.ctaPrimary}).`
      : 'Botones CTA: bg-primary text-on-primary.',
  ]
    .filter(Boolean)
    .join('\n')
}

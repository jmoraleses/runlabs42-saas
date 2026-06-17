import type { VisualBriefInference } from '@/lib/design/visualBriefInference'
import { topologyDefaultSectionTypes } from '@/lib/design/visualBriefInference'
import {
  collectReferencePalette,
  designMdPrimaryDeviatesFromProfile,
  formatPaletteMismatchReason,
  htmlProminentColorsDeviatesFromProfile,
  htmlUsesArbitraryTailwindChromaticClasses,
} from '@/lib/design/visualPaletteCompare'

const CLASSIC_HERO_FEATURES_HTML =
  /<(?:section|div)[^>]*(?:hero|features)[^>]*>[\s\S]*<(?:section|div)[^>]*features/i

function expectedSectionTypes(profile: VisualBriefInference): string[] {
  return profile.sectionTypes.length > 0
    ? profile.sectionTypes
    : topologyDefaultSectionTypes(profile.layoutTopology)
}

function countMatchedSections(html: string, expected: string[]): string[] {
  const htmlLower = html.toLowerCase()
  return expected.filter((t) => {
    const token = t.toLowerCase().replace(/_/g, '-')
    return (
      htmlLower.includes(token) ||
      htmlLower.includes(`sk-${token}`) ||
      htmlLower.includes(token.replace(/-/g, ' '))
    )
  })
}

/** Patrón estructural nav + hero + features (plantilla genérica), sin listas de copy. */
export function isClassicGenericLandingPattern(html: string): boolean {
  const lower = html.toLowerCase()
  if (
    /navigation|nav-main|site-header/i.test(lower) &&
    /\bhero\b/i.test(lower) &&
    /\bfeatures\b/i.test(lower) &&
    !/product-grid|catalog-sidebar|filters-panel|product-card/i.test(lower)
  ) {
    return true
  }
  return CLASSIC_HERO_FEATURES_HTML.test(html)
}

export function htmlIncludesCatalogPatterns(html: string): boolean {
  return /product-grid|catalog-sidebar|filters-panel|product-card|catálogo|catalogo|añadir al carrito|add to cart/i.test(
    html,
  )
}

/**
 * Desajuste estructural: plantilla genérica o secciones que no coinciden con la auditoría.
 * Sin cadenas de copy hardcodeadas — solo perfil + topología.
 */
export function isGenericAgencyLandingHtml(
  html: string,
  profile?: VisualBriefInference,
): boolean {
  if (!profile) return isClassicGenericLandingPattern(html)

  const isCatalog =
    profile.layoutTopology === 'ecommerce-catalog' ||
    profile.layoutTopology === 'ecommerce-product'
  const isMobileScreen = profile.layoutTopology === 'mobile-app-screen'

  if (
    isMobileScreen &&
    isClassicGenericLandingPattern(html) &&
    !/bottom-nav|hero-media|side-action|genre-badge/i.test(html)
  ) {
    return true
  }

  if (isCatalog && isClassicGenericLandingPattern(html) && !htmlIncludesCatalogPatterns(html)) {
    return true
  }

  const expected = expectedSectionTypes(profile)
  const matched = countMatchedSections(html, expected)
  const minRequired = Math.min(2, expected.length)

  if (expected.length > 0 && matched.length < minRequired) {
    if (isClassicGenericLandingPattern(html)) return true
    if (isCatalog) return true
  }

  return false
}

function htmlIncludesBrandName(html: string, brandName: string): boolean {
  return html.toLowerCase().includes(brandName.trim().toLowerCase())
}

/** Valida HTML generado contra la auditoría visual (datos del perfil, sin listas fijas). */
export function validateHtmlAgainstVisualProfile(
  html: string,
  profile: VisualBriefInference,
  designMd?: string,
): { ok: true } | { ok: false; reason: string } {
  const isCatalog =
    profile.layoutTopology === 'ecommerce-catalog' ||
    profile.layoutTopology === 'ecommerce-product'

  if (isGenericAgencyLandingHtml(html, profile)) {
    const expected = expectedSectionTypes(profile)
    const missing = expected.filter((t) => !countMatchedSections(html, [t]).length)
    return {
      ok: false,
      reason: missing.length
        ? `Estructura no coincide con la captura; faltan secciones: ${missing.join(', ')}`
        : 'Estructura genérica (hero/features) no coincide con la topología de la captura',
    }
  }

  const paletteCheck = htmlProminentColorsDeviatesFromProfile(html, profile, {
    designMd,
  })
  if (paletteCheck.deviates) {
    return {
      ok: false,
      reason: formatPaletteMismatchReason(profile, paletteCheck.offPalette),
    }
  }

  if (
    htmlUsesArbitraryTailwindChromaticClasses(html) &&
    collectReferencePalette(profile, designMd).length > 0
  ) {
    return {
      ok: false,
      reason:
        'Usa tokens del theme (bg-primary, text-on-primary) en lugar de clases Tailwind de color fijas (bg-blue-600, etc.)',
    }
  }

  if (profile.brandName?.trim() && !htmlIncludesBrandName(html, profile.brandName)) {
    return {
      ok: false,
      reason: `El HTML debe incluir la marca de la captura: "${profile.brandName}"`,
    }
  }

  if (isCatalog && !htmlIncludesCatalogPatterns(html)) {
    return {
      ok: false,
      reason:
        'La captura es catálogo/tienda; el HTML debe incluir grid de productos, filtros o cards con precio/CTA',
    }
  }

  const expected = expectedSectionTypes(profile)
  const matched = countMatchedSections(html, expected)
  const minRequired = Math.min(2, expected.length)
  if (expected.length > 0 && matched.length < minRequired) {
    return {
      ok: false,
      reason: `Faltan secciones de la captura en el HTML: ${expected.filter((t) => !matched.includes(t)).join(', ')}`,
    }
  }

  if (designMd?.trim() && designMdPrimaryDeviatesFromProfile(designMd, profile)) {
    return {
      ok: false,
      reason:
        'El primary de design.md no coincide con los colores de la captura; usa los hex de la auditoría visual',
    }
  }

  return { ok: true }
}

export function visualReferenceHtmlStructureBlock(profile: VisualBriefInference): string {
  const types = expectedSectionTypes(profile)
  const palette = collectReferencePalette(profile)
  return [
    '## Estructura HTML obligatoria (auditoría visual)',
    `Topología: ${profile.layoutTopology}.`,
    'Implementa en <main> una sección por cada zona de la captura, en este orden:',
    ...types.map((t, i) => `${i + 1}. <section data-sk-id="sk-${t}"> — **${t}**`),
    'No sustituyas la UI por otra plantilla distinta a la imagen adjunta.',
    profile.brandName
      ? `Marca de la captura (obligatoria en nav/títulos): **${profile.brandName}**.`
      : '',
    palette.length
      ? `Paleta de la captura (bg-primary / text-primary / tokens M3): ${palette.join(', ')}.`
      : '',
    profile.colorRoles?.ctaPrimary
      ? `CTA primary observado: ${profile.colorRoles.ctaPrimary}.`
      : '',
    'PROHIBIDO: colores hex o clases Tailwind que no estén en la paleta de la captura.',
  ]
    .filter(Boolean)
    .join('\n')
}

import type { DesignBrief, DesignSiteType } from '@/lib/design/designBrief'
import { existingDesignPagesLayoutPromptBlock } from '@/lib/design/designExistingContext'
import { visualReferenceLayoutHints } from '@/lib/design/visualReference'
import {
  type VisualBriefInference,
  layoutPagesFromVisualProfile,
  visualReferenceLayoutHintsFromProfile,
} from '@/lib/design/visualBriefInference'
import type { DesignPageMeta } from '@/lib/design/types'
import {
  parseLayoutPages,
  serializeLayoutJson,
  type AiNavigationLink,
  type OrchestrationLayoutPage,
} from '@/lib/design/orchestrationParse'

type LayoutSection = { type?: string; composition?: string; style?: string }

const UNCONVENTIONAL_SECTION_TYPES = new Set([
  'bento',
  'marquee',
  'gallery',
  'horizontal-scroll',
  'split-narrative',
  'editorial',
  'asymmetric-hero',
  'testimonial-wall',
  'stats-band',
  'logo-cloud',
  'comparison',
  'timeline',
  'magazine-grid',
])

const LAYOUT_STRATEGIES_BY_STYLE: Record<string, string[]> = {
  'asymmetric-grid': [
    'hero con peso visual desigual (60/40)',
    'bento de features',
    'CTA full-bleed con tipografía grande',
  ],
  brutalist: [
    'tipografía gigante como bloque principal',
    'grid crudo con bordes gruesos',
    'galería con scroll horizontal',
  ],
  minimalist: [
    'narrativa en una columna con mucho whitespace',
    'hero tipográfico sin imagen dominante',
    'footer compacto en una línea',
  ],
  bento: ['grid bento irregular', 'cards de distintos tamaños', 'hero integrado en el bento'],
  magazine: ['portada editorial', 'módulos de artículos', 'pull-quote destacado'],
  'horizontal-scroll': [
    'carrusel de proyectos a ancho completo',
    'hero con scroll lateral',
    'sección de logos en marquee',
  ],
}

const SITE_TYPE_HINTS: Record<DesignSiteType, string> = {
  landing: 'Prioriza conversión: hero claro, prueba social, CTA repetido sin copiar plantillas SaaS genéricas.',
  ecommerce: 'Catálogo o colección destacada, filtros visuales, confianza (envíos/devoluciones).',
  portfolio: 'Showcase visual fuerte, casos o proyectos en grid asimétrico, contacto al final.',
  dashboard: 'Sidebar o top-nav de app, métricas, tablas o cards de datos — no landing marketing.',
  blog: 'Jerarquía editorial, listados de posts, tipografía de lectura.',
  saas: 'Propuesta de valor, features diferenciados, pricing o demo — evita el cliché hero+3 iconos.',
}

/** Semilla estable por prompt para variar composiciones entre generaciones. */
export function layoutVarietySeed(prompt: string): number {
  let h = 0
  const s = prompt.trim().toLowerCase()
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

/** Añade restricciones cuando ya hay pantallas en el lienzo. */
export function layoutExistingPagesHints(existingPrimary?: DesignPageMeta[]): string {
  const block = existingDesignPagesLayoutPromptBlock(existingPrimary ?? [])
  return block ? `\n${block}` : ''
}

export function layoutVarietyHints(
  tokensJson: string,
  brief?: DesignBrief,
  opts?: { hasVisualReference?: boolean; visualProfile?: VisualBriefInference | null },
): string {
  if (opts?.visualProfile) return visualReferenceLayoutHintsFromProfile(opts.visualProfile)
  if (opts?.hasVisualReference) return visualReferenceLayoutHints()

  let layoutStyle = ''
  try {
    const parsed = JSON.parse(tokensJson) as {
      tokens?: { ui?: { layoutStyle?: string } }
    }
    layoutStyle = String(parsed.tokens?.ui?.layoutStyle ?? '').trim().toLowerCase()
  } catch {
    /* ignore */
  }

  const strategies =
    LAYOUT_STRATEGIES_BY_STYLE[layoutStyle] ??
    LAYOUT_STRATEGIES_BY_STYLE.minimalist ??
    ['composición modular no lineal', 'sección con jerarquía visual inesperada']

  const seed = layoutVarietySeed(brief?.prompt ?? '')
  const rotated = [...strategies]
  for (let i = rotated.length - 1; i > 0; i--) {
    const j = (seed + i * 17) % (i + 1)
    const tmp = rotated[i]!
    rotated[i] = rotated[j]!
    rotated[j] = tmp
  }
  const picked = rotated.slice(0, 2)
  const siteHint = brief?.siteType ? SITE_TYPE_HINTS[brief.siteType] : ''

  return [
    '## Variabilidad de layout (obligatorio)',
    `Semilla de composición: ${seed % 10000} (no reutilices el mismo orden de secciones que otros sitios).`,
    `Estilo visual declarado: ${layoutStyle || 'único según brief'}.`,
    `Prioriza estas composiciones (elige y combina): ${picked.join('; ')}.`,
    'No repitas la secuencia genérica navigation → hero → features → footer en todas las páginas.',
    siteHint,
  ]
    .filter(Boolean)
    .join('\n')
}

function sectionsOf(page: OrchestrationLayoutPage): LayoutSection[] {
  if (!Array.isArray(page.sections)) return []
  return page.sections as LayoutSection[]
}

function isClassicHeroStack(sections: LayoutSection[]): boolean {
  const types = sections.map((s) => String(s.type ?? '').toLowerCase())
  const navIdx = types.indexOf('navigation')
  const heroIdx = types.indexOf('hero')
  const featIdx = types.findIndex((t) => t === 'features' || t === 'feature-grid' || t === 'features-grid')
  return navIdx >= 0 && heroIdx >= 0 && featIdx >= 0 && navIdx < heroIdx && heroIdx < featIdx
}

function hasUnconventionalSection(sections: LayoutSection[]): boolean {
  return sections.some((s) => {
    const type = String(s.type ?? '').toLowerCase()
    if (UNCONVENTIONAL_SECTION_TYPES.has(type)) return true
    const comp = String(s.composition ?? '').toLowerCase()
    return comp && !['default', 'standard', 'centered'].includes(comp)
  })
}

export type LayoutValidationResult = { ok: true } | { ok: false; reason: string }

const ECOMMERCE_CATALOG_FALLBACK_SECTIONS: LayoutSection[] = [
  { type: 'site-header', style: 'sticky' },
  { type: 'catalog-sidebar', composition: 'filters' },
  { type: 'product-grid', composition: 'three-column' },
  { type: 'pagination', composition: 'centered' },
  { type: 'site-footer', style: 'compact' },
]

const FALLBACK_SECTIONS_BY_SITE: Record<DesignSiteType, LayoutSection[]> = {
  landing: [
    { type: 'navigation', style: 'minimal' },
    { type: 'bento', composition: 'asymmetric' },
    { type: 'marquee', composition: 'full-bleed' },
    { type: 'footer', style: 'compact' },
  ],
  ecommerce: [
    { type: 'navigation', style: 'sticky' },
    { type: 'bento', composition: 'product-grid' },
    { type: 'gallery', composition: 'horizontal-scroll' },
    { type: 'footer', style: 'compact' },
  ],
  portfolio: [
    { type: 'navigation', style: 'minimal' },
    { type: 'asymmetric-hero', composition: 'left-heavy' },
    { type: 'gallery', composition: 'masonry' },
    { type: 'footer', style: 'compact' },
  ],
  dashboard: [
    { type: 'navigation', style: 'sidebar' },
    { type: 'stats-band', composition: 'four-up' },
    { type: 'bento', composition: 'data-cards' },
  ],
  blog: [
    { type: 'navigation', style: 'editorial' },
    { type: 'magazine-grid', composition: 'featured' },
    { type: 'split-narrative', composition: 'two-column' },
    { type: 'footer', style: 'compact' },
  ],
  saas: [
    { type: 'navigation', style: 'floating' },
    { type: 'split-narrative', composition: 'product-demo' },
    { type: 'comparison', composition: 'pricing' },
    { type: 'footer', style: 'compact' },
  ],
}

export type FallbackLayoutOpts = {
  /** Con captura: nunca usar plantillas landing/ecommerce genéricas del sistema. */
  visualReferenceOnly?: boolean
}

/** Layout mínimo cuando el modelo no devuelve páginas parseables. */
export function fallbackLayoutPagesForBrief(
  brief?: DesignBrief,
  visualProfile?: VisualBriefInference | null,
  opts?: FallbackLayoutOpts,
): OrchestrationLayoutPage[] {
  if (visualProfile && (visualProfile.sectionTypes.length || opts?.visualReferenceOnly)) {
    const fromAudit = layoutPagesFromVisualProfile(visualProfile)
    if (fromAudit[0]?.sections?.length) return fromAudit
  }

  if (opts?.visualReferenceOnly) {
    return layoutPagesFromVisualProfile(
      visualProfile ?? {
        layoutTopology: 'other',
        sectionTypes: ['site-header', 'main-content', 'site-footer'],
      },
    ).slice(0, 1)
  }

  const topology = visualProfile?.layoutTopology
  const siteType =
    brief?.siteType ??
    (topology === 'ecommerce-catalog' || topology === 'ecommerce-product'
      ? 'ecommerce'
      : undefined) ??
    'landing'

  const homeSections =
    topology === 'ecommerce-catalog' || topology === 'ecommerce-product'
      ? ECOMMERCE_CATALOG_FALLBACK_SECTIONS
      : FALLBACK_SECTIONS_BY_SITE[siteType] ?? FALLBACK_SECTIONS_BY_SITE.landing
  const pages: OrchestrationLayoutPage[] = [
    {
      id: 'home',
      name: 'Inicio',
      layoutStrategy: 'fallback-modular',
      sections: homeSections,
    },
  ]
  if (siteType === 'ecommerce') {
    pages.push({
      id: 'catalog',
      name: 'Catálogo',
      layoutStrategy: 'product-grid',
      sections: [
        { type: 'navigation', style: 'sticky' },
        { type: 'gallery', composition: 'product-grid' },
      ],
    })
  } else if (siteType === 'saas') {
    pages.push({
      id: 'pricing',
      name: 'Precios',
      layoutStrategy: 'pricing-split',
      sections: [
        { type: 'navigation', style: 'minimal' },
        { type: 'comparison', composition: 'tiers' },
      ],
    })
  }
  return pages
}

export function layoutJsonFromPages(
  pages: OrchestrationLayoutPage[],
  navigationLinks?: AiNavigationLink[],
): string {
  return serializeLayoutJson(pages, navigationLinks)
}

/** Con referencia visual: no expandir a varias pantallas desde el layout del modelo. */
export function clampLayoutPagesForVisualReference(
  pages: OrchestrationLayoutPage[],
  hasVisualReference: boolean,
): OrchestrationLayoutPage[] {
  if (!hasVisualReference || pages.length <= 1) return pages
  const home = pages.find((p) => p.id === 'home') ?? pages[0]
  return home ? [home] : pages.slice(0, 1)
}

/** Valida que el layout no sea una plantilla repetitiva. */
function layoutSectionTypesJoined(pages: OrchestrationLayoutPage[]): string {
  return pages
    .flatMap((p) => sectionsOf(p).map((s) => String(s.type ?? '').toLowerCase()))
    .join(' ')
}

/** Valida que el layout JSON refleje patrones visibles en HTML Stitch. */
export function validateLayoutPlanAgainstStitch(
  layoutJson: string,
  referenceHtml: string,
): LayoutValidationResult {
  const pages = parseLayoutPages(layoutJson)
  if (!pages.length) {
    return { ok: false, reason: 'Sin páginas en el layout' }
  }

  const ref = referenceHtml.toLowerCase()
  const home = pages.find((p) => p.id === 'home') ?? pages[0]!
  const types = layoutSectionTypesJoined([home])

  if (/bento|col-span-2|md:col-span/i.test(ref)) {
    const hasBentoLike = /bento|benefit|trust|asymmetric|marquee|split/.test(types)
    if (!hasBentoLike && isClassicHeroStack(sectionsOf(home))) {
      return {
        ok: false,
        reason:
          'La referencia Stitch usa bento/beneficios asimétricos; evita navigation → hero → features plano',
      }
    }
  }

  if (/product|chick|pollito|shop|grid-cols-2|grid-cols-3/i.test(ref)) {
    const hasCatalog = /product|gallery|catalog|grid|collection|shop/.test(types)
    if (!hasCatalog && sectionsOf(home).length >= 3) {
      return {
        ok: false,
        reason:
          'La referencia incluye catálogo o grid de productos; añade section.type product-grid o gallery',
      }
    }
  }

  return { ok: true }
}

function layoutTypesIncludeCatalog(typesJoined: string): boolean {
  return /product|catalog|gallery|shop|filter|sidebar|collection|grid/.test(typesJoined)
}

function layoutTypesIncludeSidebarFilters(typesJoined: string): boolean {
  return /sidebar|filter|facet|catalog-sidebar|filters-panel/.test(typesJoined)
}

function normalizeSectionTypeToken(type: string): string {
  return type.trim().toLowerCase().replace(/_/g, '-')
}

/** Exige que el layout incluya secciones clave observadas en la auditoría. */
export function validateLayoutMatchesVisualSectionTypes(
  layoutJson: string,
  profile: VisualBriefInference,
): LayoutValidationResult {
  const expected = profile.sectionTypes.map(normalizeSectionTypeToken).filter(Boolean)
  if (!expected.length) return { ok: true }

  const pages = parseLayoutPages(layoutJson)
  const typesJoined = layoutSectionTypesJoined(pages)
  const layoutTypes = typesJoined.split(/\s+/).filter(Boolean)

  const matches = expected.filter((exp) =>
    layoutTypes.some((t) => t === exp || t.includes(exp) || exp.includes(t)),
  )

  const minRequired = Math.min(2, expected.length)
  if (matches.length < minRequired) {
    return {
      ok: false,
      reason: `El layout debe incluir las secciones de la captura (faltan: ${expected.filter((e) => !matches.includes(e)).join(', ')})`,
    }
  }
  return { ok: true }
}

/** Valida layout contra la auditoría visual (captura del usuario). */
export function validateLayoutPlanAgainstVisualProfile(
  layoutJson: string,
  profile: VisualBriefInference,
): LayoutValidationResult {
  const pages = parseLayoutPages(layoutJson)
  if (!pages.length) {
    return { ok: false, reason: 'Sin páginas en el layout' }
  }

  const home = pages.find((p) => p.id === 'home') ?? pages[0]!
  const homeSections = sectionsOf(home)
  const typesJoined = layoutSectionTypesJoined([home])

  const isCatalogTopology =
    profile.layoutTopology === 'ecommerce-catalog' ||
    profile.layoutTopology === 'ecommerce-product'

  if (isCatalogTopology) {
    if (!layoutTypesIncludeCatalog(typesJoined)) {
      return {
        ok: false,
        reason:
          'La captura es un catálogo/tienda; el layout debe incluir product-grid o gallery con cards de producto',
      }
    }
    if (
      profile.sectionTypes.some((s) => /sidebar|filter|catalog/.test(s)) &&
      !layoutTypesIncludeSidebarFilters(typesJoined)
    ) {
      return {
        ok: false,
        reason:
          'La captura muestra sidebar de filtros; añade catalog-sidebar o filters-panel',
      }
    }
    if (homeSections.length >= 3 && isClassicHeroStack(homeSections)) {
      return {
        ok: false,
        reason:
          'La captura es catálogo e-commerce; no uses navigation → hero → features de landing genérica',
      }
    }
    return { ok: true }
  }

  if (profile.layoutTopology === 'landing-marketing') {
    if (layoutTypesIncludeCatalog(typesJoined) && !profile.sectionTypes.some((s) => /product|catalog/.test(s))) {
      return {
        ok: false,
        reason:
          'La captura es landing marketing; no añadas catálogo de productos si no aparece en la imagen',
      }
    }
  }

  if (profile.layoutTopology === 'mobile-app-screen') {
    if (pages.length > 1) {
      return {
        ok: false,
        reason:
          'La captura es una pantalla móvil; declara una sola page (no Inicio/Catálogo/Nosotros/Contacto)',
      }
    }
    const hasMobileChrome =
      /bottom-nav|hero-media|side-action|primary-cta|genre-badge|status-bar/.test(typesJoined)
    if (!hasMobileChrome && isClassicHeroStack(homeSections)) {
      return {
        ok: false,
        reason:
          'La captura es app móvil; evita landing web navigation → hero → features',
      }
    }
  }

  if (homeSections.length >= 3 && isClassicHeroStack(homeSections)) {
    const profileWantsCatalog = profile.sectionTypes.some((s) =>
      /product|catalog|filter|sidebar/.test(s),
    )
    if (profileWantsCatalog) {
      return {
        ok: false,
        reason:
          'La captura incluye catálogo/filtros; evita el patrón navigation → hero → features',
      }
    }
  }

  return { ok: true }
}

export function validateLayoutPlan(
  layoutJson: string,
  tokensJson: string,
  opts?: {
    hasVisualReference?: boolean
    stitchReferenceHtml?: string
    visualProfile?: VisualBriefInference | null
  },
): LayoutValidationResult {
  const pages = parseLayoutPages(layoutJson)
  if (!pages.length) {
    return { ok: false, reason: 'Sin páginas en el layout' }
  }

  const stitchHtml = opts?.stitchReferenceHtml?.trim()
  if (stitchHtml) {
    const stitchResult = validateLayoutPlanAgainstStitch(layoutJson, stitchHtml)
    if (!stitchResult.ok) return stitchResult
  }

  if (opts?.visualProfile) {
    const visualResult = validateLayoutPlanAgainstVisualProfile(layoutJson, opts.visualProfile)
    if (!visualResult.ok) return visualResult
    const sectionMatch = validateLayoutMatchesVisualSectionTypes(layoutJson, opts.visualProfile)
    if (!sectionMatch.ok) return sectionMatch
  }

  const home = pages.find((p) => p.id === 'home') ?? pages[0]!
  const homeSections = sectionsOf(home)

  if (homeSections.length >= 3 && isClassicHeroStack(homeSections)) {
    return {
      ok: false,
      reason: opts?.hasVisualReference
        ? 'Con referencia visual adjunta no uses navigation → hero → features; replica la topología de la captura'
        : 'La página principal repite el patrón clásico navigation → hero → features',
    }
  }

  let layoutStyle = ''
  try {
    const tokens = JSON.parse(tokensJson) as { tokens?: { ui?: { layoutStyle?: string } } }
    layoutStyle = String(tokens.tokens?.ui?.layoutStyle ?? '').toLowerCase()
  } catch {
    /* ignore */
  }

  const needsUnconventional = ['brutalist', 'asymmetric-grid', 'bento', 'magazine', 'horizontal-scroll'].some(
    (s) => layoutStyle.includes(s),
  )

  if (needsUnconventional && homeSections.length > 0 && !hasUnconventionalSection(homeSections)) {
    return {
      ok: false,
      reason: `El layoutStyle "${layoutStyle}" requiere al menos una sección no convencional`,
    }
  }

  return { ok: true }
}

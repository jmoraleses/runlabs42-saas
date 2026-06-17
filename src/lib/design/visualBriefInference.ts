import 'server-only'

import type { VertexImagePart } from '@/lib/ai/vertexAgentPlatform'
import { generateAgentPlatformText } from '@/lib/ai/vertexAgentPlatform'
import type { DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import { parseDesignDevice } from '@/lib/design/breakpoints'
import type { DesignBrief, DesignSiteType, OrchestrationLocale } from '@/lib/design/designBrief'
import type { OrchestrationLayoutPage } from '@/lib/design/orchestrationParse'
import {
  type VisualColorRoles,
  parseVisualColorRoles,
  visualReferenceColorRolesBlock,
} from '@/lib/design/visualColorRoles'

export { VisualAuditRequiredError } from '@/lib/design/visualAuditErrors'

/** Topología observada en la captura (auditoría previa, estilo Stitch). */
export type VisualLayoutTopology =
  | 'ecommerce-catalog'
  | 'ecommerce-product'
  | 'landing-marketing'
  | 'portfolio-showcase'
  | 'dashboard-app'
  | 'mobile-app-screen'
  | 'blog-editorial'
  | 'other'

export type VisualBriefInference = {
  siteType?: DesignSiteType
  brandTone?: string
  businessModel?: string
  brandName?: string
  /** mobile | tablet | desktop observado en la captura. */
  referenceFormFactor?: DesignPreviewBreakpoint
  layoutTopology: VisualLayoutTopology
  /** section.type sugeridos para layout JSON (site-header, catalog-sidebar, product-grid…). */
  sectionTypes: string[]
  dominantColors?: string[]
  /** Roles cromáticos (CTA, badges NUEVO/TOP VENTAS, fondo). */
  colorRoles?: VisualColorRoles
  locale?: OrchestrationLocale
}

const SITE_TYPES = new Set<DesignSiteType>([
  'landing',
  'ecommerce',
  'portfolio',
  'dashboard',
  'blog',
  'saas',
])

const TOPOLOGIES = new Set<VisualLayoutTopology>([
  'ecommerce-catalog',
  'ecommerce-product',
  'landing-marketing',
  'portfolio-showcase',
  'dashboard-app',
  'mobile-app-screen',
  'blog-editorial',
  'other',
])

function parseInferenceJson(text: string): VisualBriefInference | null {
  const raw = text.trim()
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fence ?? raw).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
    const topologyRaw = String(parsed.layoutTopology ?? parsed.topology ?? '').trim()
    const layoutTopology = TOPOLOGIES.has(topologyRaw as VisualLayoutTopology)
      ? (topologyRaw as VisualLayoutTopology)
      : 'other'

    const siteTypeRaw = String(parsed.siteType ?? '').trim().toLowerCase()
    const siteType = SITE_TYPES.has(siteTypeRaw as DesignSiteType)
      ? (siteTypeRaw as DesignSiteType)
      : undefined

    const sectionTypes = Array.isArray(parsed.sectionTypes)
      ? parsed.sectionTypes
          .map((s) => String(s).trim().toLowerCase())
          .filter(Boolean)
      : []

    const dominantColors = Array.isArray(parsed.dominantColors)
      ? parsed.dominantColors
          .map((c) => String(c).trim())
          .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
      : undefined

    const localeRaw = String(parsed.locale ?? '').trim().toLowerCase()
    const locale: OrchestrationLocale | undefined =
      localeRaw === 'es' || localeRaw === 'en' ? localeRaw : undefined

    const formFactorRaw = String(
      parsed.referenceFormFactor ?? parsed.formFactor ?? parsed.device ?? '',
    ).trim()

    return {
      siteType,
      brandTone: String(parsed.brandTone ?? '').trim() || undefined,
      businessModel: String(parsed.businessModel ?? '').trim() || undefined,
      brandName: String(parsed.brandName ?? parsed.brand ?? '').trim() || undefined,
      referenceFormFactor: formFactorRaw ? parseDesignDevice(formFactorRaw) : undefined,
      layoutTopology,
      sectionTypes,
      dominantColors: dominantColors?.length ? dominantColors : undefined,
      colorRoles: parseVisualColorRoles(parsed.colorRoles),
      locale,
    }
  } catch {
    return null
  }
}

const VISUAL_AUDIT_SYSTEM = `Eres el auditor visual de Google Stitch: analizas capturas de UI antes de generar design.md y layout.
Responde SOLO JSON válido (sin markdown) con esta forma:
{
  "siteType": "landing|ecommerce|portfolio|dashboard|blog|saas",
  "layoutTopology": "ecommerce-catalog|ecommerce-product|landing-marketing|portfolio-showcase|dashboard-app|mobile-app-screen|blog-editorial|other",
  "referenceFormFactor": "mobile|tablet|desktop",
  "brandName": "nombre visible en logo/nav o vacío",
  "brandTone": "2-6 palabras (premium, minimalista, orgánico…)",
  "businessModel": "qué vende o propone el sitio en una frase",
  "sectionTypes": ["site-header", "catalog-sidebar", "product-grid", "..."],
  "dominantColors": ["#RRGGBB", "..."],
  "colorRoles": {
    "pageBackground": "#RRGGBB",
    "ctaPrimary": "#RRGGBB",
    "accentHighlight": "#RRGGBB",
    "heroMuted": "#RRGGBB",
    "badgeNew": "#RRGGBB",
    "badgeTopSales": "#RRGGBB",
    "badgePremium": "#RRGGBB",
    "textPrimary": "#RRGGBB",
    "textMuted": "#RRGGBB",
    "promoBannerBg": "#RRGGBB",
    "promoBannerCta": "#RRGGBB"
  },
  "locale": "es|en"
}
Reglas:
- Observa la captura: NO inventes landing de agencia si la UI es catálogo/tienda (sidebar filtros, grid de productos, cards con precio).
- ecommerce-catalog: listado con filtros, grid de productos, paginación; sectionTypes debe incluir product-grid y catalog-sidebar o filters-panel.
- landing-marketing: describe solo las zonas visibles (hero, beneficios, grid asimétrico, CTA, footer); NO uses product-grid salvo que aparezca en la imagen.
- mobile-app-screen: UNA sola pantalla móvil (status bar, hero con imagen de fondo, badges, CTAs, acciones laterales, bottom-nav). NO inventes sitio multi-página (Inicio/Catálogo/Nosotros/Contacto).
- referenceFormFactor: mobile si la captura es smartphone (~390px ancho o ratio alto); desktop si es web ancha.
- brandName: texto exacto del logo/nav/título principal si es visible (p. ej. NEON DREAMS).
- dominantColors: 3-6 hex muestreados de la captura (fondos, CTAs, acentos).
- colorRoles: hex EXACTOS por rol observado (ctaPrimary, pageBackground, accentHighlight, textPrimary, textMuted; en tienda también badgeNew, badgeTopSales si hay etiquetas).
- sectionTypes: nombres kebab-case por zona visible (orden top→bottom); no inventes secciones que no aparecen.`

/** Auditoría multimodal previa (paridad Stitch: captura → tokens/layout). */
export async function inferVisualBriefFromImages(opts: {
  images: VertexImagePart[]
  prompt: string
  modelId: string
}): Promise<VisualBriefInference | null> {
  if (!opts.images.length) return null

  const userPrompt = `Audita la imagen adjunta y el brief del usuario.

Brief del usuario:
${opts.prompt.trim() || '(solo imagen adjunta)'}

Si el brief contradice la captura (p. ej. pide sitio web de galería pero la imagen es una app móvil), prioriza SIEMPRE lo visible en la imagen.
Extrae siteType, layoutTopology, referenceFormFactor, marca, tono, secciones visibles y hex dominantes de la captura.`

  try {
    const text = await generateAgentPlatformText(userPrompt, {
      systemInstruction: VISUAL_AUDIT_SYSTEM,
      model: opts.modelId.includes('flash-lite')
        ? opts.modelId.replace('flash-lite', 'flash')
        : opts.modelId,
      images: opts.images,
      responseMimeType: 'application/json',
      preferRealtime: true,
      temperature: 0.2,
    })
    let parsed = parseInferenceJson(text)
    if (!parsed) {
      console.warn('[visualBriefInference] No se pudo parsear auditoría visual:', text.slice(0, 300))
      return null
    }
    if (!isVisualProfileActionable(parsed)) {
      const retryText = await generateAgentPlatformText(
        `${userPrompt}\n\nReintento: lista sectionTypes de todas las zonas visibles, layoutTopology correcto, y dominantColors + colorRoles con hex exactos de la captura.`,
        {
          systemInstruction: VISUAL_AUDIT_SYSTEM,
          model: 'gemini-2.5-flash',
          images: opts.images,
          responseMimeType: 'application/json',
          preferRealtime: true,
          temperature: 0.1,
        },
      )
      const retryParsed = parseInferenceJson(retryText)
      if (retryParsed && isVisualProfileActionable(retryParsed)) {
        parsed = retryParsed
      }
    }
    return parsed
  } catch (err) {
    console.warn(
      '[visualBriefInference] Auditoría visual falló:',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/** Enriquece el brief con campos inferidos de la captura (sin pisar explícitos). */
/** Perfil con paleta y estructura suficientes para orquestar sin plantillas genéricas. */
export function isVisualProfileActionable(profile: VisualBriefInference): boolean {
  const hasPalette =
    Boolean(profile.dominantColors?.length) ||
    Boolean(
      profile.colorRoles?.ctaPrimary ||
        profile.colorRoles?.pageBackground ||
        profile.colorRoles?.accentHighlight,
    )
  const hasStructure =
    profile.sectionTypes.length > 0 || profile.layoutTopology !== 'other'
  return hasPalette && hasStructure
}

/** JSON de auditoría inyectado en cada fase (design, layout, HTML). */
export function visualAuditPromptBlock(profile: VisualBriefInference): string {
  return [
    '## Auditoría visual (spec/visual-audit.json — obligatorio)',
    'Usa este JSON como fuente de verdad junto con la imagen adjunta. No inventes otra UI ni otra paleta.',
    '```json',
    JSON.stringify(profile, null, 2),
    '```',
  ].join('\n')
}

export function mergeVisualInferenceIntoBrief(
  brief: DesignBrief,
  inference: VisualBriefInference,
): DesignBrief {
  const lines: string[] = [brief.prompt.trim()]
  if (inference.brandName && !brief.prompt.toLowerCase().includes(inference.brandName.toLowerCase())) {
    lines.push(`Marca en la referencia visual: ${inference.brandName}.`)
  }
  if (inference.dominantColors?.length) {
    lines.push(
      `Colores dominantes observados en la captura (usar en design.md): ${inference.dominantColors.join(', ')}.`,
    )
  }
  if (inference.colorRoles) {
    lines.push(visualReferenceColorRolesBlock(inference.colorRoles))
  }
  if (inference.sectionTypes.length) {
    lines.push(
      `Estructura visible (replicar en layout): ${inference.sectionTypes.join(' → ')}.`,
    )
  }

  return {
    ...brief,
    prompt: lines.filter(Boolean).join('\n'),
    // La captura manda sobre siteType inferido del texto ("landing", "marketing", etc.).
    siteType: inference.siteType ?? brief.siteType,
    brandTone: brief.brandTone ?? inference.brandTone,
    businessModel: brief.businessModel ?? inference.businessModel,
    locale: brief.locale ?? inference.locale,
    requiredSections: undefined,
  }
}

/** Bloque de hints para layout JSON (como stitchLayoutParityHints). */
export function visualReferenceLayoutHintsFromProfile(profile: VisualBriefInference): string {
  const lines = [
    '## Layout fiel a la captura adjunta (auditoría visual — obligatorio)',
    `Topología detectada: **${profile.layoutTopology}**.`,
    'El JSON de layout debe replicar la misma estructura que la imagen; prohibido sustituir por landing genérico (hero + 3 pilares + contacto) si la captura es otra cosa.',
    'Declara section.type descriptivos (site-header, catalog-sidebar, product-grid, filters-panel, site-footer, etc.).',
    'Una sola page si la captura es una sola pantalla.',
  ]

  if (profile.sectionTypes.length) {
    lines.push(
      'Secciones observadas en la captura (incluir en sections[] en este orden):',
      ...profile.sectionTypes.map((s) => `- ${s}`),
    )
  }

  if (profile.layoutTopology === 'ecommerce-catalog' || profile.layoutTopology === 'ecommerce-product') {
    lines.push(
      '- Incluye **catalog-sidebar** o **filters-panel** si hay columna de filtros/checkboxes.',
      '- Incluye **product-grid** con cards de producto (imagen, precio, CTA).',
      '- NO uses solo navigation → hero → features; eso contradice un catálogo.',
    )
  }

  if (profile.layoutTopology === 'landing-marketing') {
    lines.push(
      '- Replica las mismas zonas que la captura (no sustituyas por otra plantilla).',
      profile.brandName
        ? `- Marca obligatoria en nav: **${profile.brandName}**.`
        : '',
    )
  }

  if (profile.layoutTopology === 'mobile-app-screen') {
    lines.push(
      '- UNA sola page en el JSON (id: home o screen).',
      '- Incluye hero-media-overlay, primary-cta-row, side-action-rail y bottom-nav si aparecen en la captura.',
      '- Dispositivo: móvil (~390px); NO generes web multi-página de galería/arte salvo que la imagen lo muestre.',
      profile.brandName ? `- Título/marca visible: **${profile.brandName}**.` : '',
    )
  }

  if (profile.dominantColors?.length) {
    lines.push(`- Paleta visible: ${profile.dominantColors.join(', ')} (coherente con design.md).`)
  }

  return lines.join('\n')
}

/** Secciones por topología cuando el modelo no listó sectionTypes (sin plantilla hero→features). */
export function topologyDefaultSectionTypes(topology: VisualLayoutTopology): string[] {
  switch (topology) {
    case 'ecommerce-catalog':
      return ['site-header', 'catalog-sidebar', 'product-grid', 'pagination', 'site-footer']
    case 'ecommerce-product':
      return ['site-header', 'product-detail', 'related-products', 'site-footer']
    case 'landing-marketing':
      return ['site-header', 'main-content', 'site-footer']
    case 'portfolio-showcase':
      return ['site-header', 'asymmetric-hero', 'project-gallery', 'contact-strip', 'site-footer']
    case 'dashboard-app':
      return ['app-sidebar', 'stats-band', 'data-cards', 'app-footer']
    case 'mobile-app-screen':
      return [
        'status-bar',
        'hero-media-overlay',
        'genre-badge',
        'primary-cta-row',
        'side-action-rail',
        'bottom-nav',
      ]
    case 'blog-editorial':
      return ['site-header', 'featured-article', 'article-grid', 'newsletter', 'site-footer']
    default:
      return ['site-header', 'main-content', 'site-footer']
  }
}

/** Layout JSON derivado solo de la auditoría visual (sin plantillas genéricas del sistema). */
export function layoutPagesFromVisualProfile(
  profile: VisualBriefInference,
): OrchestrationLayoutPage[] {
  const types =
    profile.sectionTypes.length > 0
      ? profile.sectionTypes
      : topologyDefaultSectionTypes(profile.layoutTopology)

  const sections = types.map((type) => ({
    type,
    composition: 'reference-fidelity',
    style: 'from-screenshot',
  }))

  return [
    {
      id: 'home',
      name: profile.brandName?.trim() || 'Inicio',
      layoutStrategy: 'visual-reference-fidelity',
      sections,
    },
  ]
}

export function siteTypeFromVisualTopology(
  topology: VisualLayoutTopology,
): DesignSiteType | undefined {
  switch (topology) {
    case 'ecommerce-catalog':
    case 'ecommerce-product':
      return 'ecommerce'
    case 'landing-marketing':
      return 'landing'
    case 'portfolio-showcase':
      return 'portfolio'
    case 'dashboard-app':
      return 'dashboard'
    case 'mobile-app-screen':
      return 'saas'
    case 'blog-editorial':
      return 'blog'
    default:
      return undefined
  }
}

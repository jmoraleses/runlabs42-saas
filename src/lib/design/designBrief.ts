/** Brief estructurado para orquestación de diseño (retrocompatible con prompt libre). */
export type DesignSiteType =
  | 'landing'
  | 'ecommerce'
  | 'portfolio'
  | 'dashboard'
  | 'blog'
  | 'saas'

export type OrchestrationLocale = 'es' | 'en'

export type DesignBrief = {
  /** Texto principal del usuario (obligatorio en API). */
  prompt: string
  /** Idioma del copy de UI; si no se envía, se infiere del prompt (por defecto es). */
  locale?: OrchestrationLocale
  businessModel?: string
  brandTone?: string
  siteType?: DesignSiteType
  /** Si el prompt pide una cantidad exacta de páginas, se respeta aquí. */
  requestedPageCount?: number
  requiredSections?: string[]
  /** Proyecto Stitch (id numérico) para paridad: uploads/stitch-reference/{id}/ */
  stitchProjectId?: string
  stitchScreenId?: string
}

export function parseDesignBriefFromBody(
  body: Record<string, unknown>,
  prompt: string,
): DesignBrief {
  const briefRaw =
    body.brief && typeof body.brief === 'object' && !Array.isArray(body.brief)
      ? (body.brief as Record<string, unknown>)
      : null

  const siteTypeRaw = String(briefRaw?.siteType ?? body.siteType ?? '').trim().toLowerCase()
  const siteTypes: DesignSiteType[] = [
    'landing',
    'ecommerce',
    'portfolio',
    'dashboard',
    'blog',
    'saas',
  ]
  const siteType = siteTypes.includes(siteTypeRaw as DesignSiteType)
    ? (siteTypeRaw as DesignSiteType)
    : undefined

  const requiredSections = parseStringArray(briefRaw?.requiredSections ?? body.requiredSections)
  const requestedPageCount = parseRequestedPageCount(
    briefRaw?.requestedPageCount ?? body.requestedPageCount,
  )

  const localeRaw = pickString(briefRaw?.locale ?? body.locale)?.toLowerCase()
  const locale: OrchestrationLocale | undefined =
    localeRaw === 'en' || localeRaw === 'es' ? localeRaw : undefined

  return {
    prompt,
    businessModel: pickString(briefRaw?.businessModel ?? body.businessModel),
    brandTone: pickString(briefRaw?.brandTone ?? body.brandTone),
    siteType,
    requestedPageCount,
    requiredSections: requiredSections.length ? requiredSections : undefined,
    stitchProjectId: pickString(briefRaw?.stitchProjectId ?? body.stitchProjectId),
    stitchScreenId: pickString(briefRaw?.stitchScreenId ?? body.stitchScreenId),
    locale,
  }
}

/** Idioma de copy en HTML/layout; por defecto español (producto Runlabs). */
export function resolveOrchestrationLocale(brief: DesignBrief): OrchestrationLocale {
  if (brief.locale === 'en' || brief.locale === 'es') return brief.locale
  const env = process.env.DESIGN_ORCHESTRATION_LOCALE?.trim().toLowerCase()
  if (env === 'en' || env === 'es') return env

  const text = [brief.prompt, brief.brandTone, brief.businessModel].filter(Boolean).join(' ')
  if (/\b(english|in english|en inglés|lang(uage)?\s*[:=]\s*en|ui in english)\b/i.test(text)) {
    return 'en'
  }
  if (
    /\b(español|en español|castellano|lang(uaje)?\s*[:=]\s*es|página|diseño|tienda|marca|landing de)\b/i.test(
      text,
    )
  ) {
    return 'es'
  }
  return 'es'
}

/** Bloque extra en html-review cuando el modelo dejó copy inglés de la referencia Stitch. */
export function orchestrationLocaleHtmlReviewBlock(locale: OrchestrationLocale): string {
  if (locale !== 'es') return ''
  return `## Traducción de copy (P0 — obligatorio)
- Si el HTML contiene textos en inglés heredados de una referencia visual, **tradúcelos al español** según el brief actual (mismo tono del producto).
- Usa **solo** el nombre de marca y la propuesta del brief; no reutilices marcas, eslóganes ni copy de otros productos o sesiones.
- Tras corregir, el documento debe tener \`<html lang="es">\` y **ningún** titular/CTA principal en inglés.`
}

export function orchestrationLocalePromptRules(locale: OrchestrationLocale): string {
  if (locale === 'en') {
    return `## UI language (required)
- All visible copy (headings, nav, buttons, body, placeholders): **English**.
- Each HTML document: \`<html lang="en">\`.
- If Stitch reference HTML is in another language, match layout/classes only; write copy in English per the brief.`
  }
  return `## Idioma de la interfaz (obligatorio)
- Todo el copy visible (títulos, nav, botones, párrafos, placeholders, alt breves): **español**.
- Cada documento HTML: \`<html lang="es">\`.
- Si la referencia Stitch/HTML está en inglés: replica **solo** layout, clases Tailwind y jerarquía; **traduce** el texto al español según el brief actual.
- El nombre de marca y el copy salen **únicamente** del brief de esta generación; no reutilices marcas ni textos de briefs anteriores.`
}

/** Evita que el modelo arrastre un producto/marca de ejemplos o sesiones previas. */
export function orchestrationFreshDesignIsolationBlock(): string {
  return `## Diseño desde cero (obligatorio)
- Trata este brief como un producto **nuevo**; no reutilices nombre de marca, paleta, tipografía ni secciones de diseños anteriores.
- Si el brief no menciona un animal, color o sector concreto, no los inventes por costumbre de ejemplos previos.`
}

function pickString(v: unknown): string | undefined {
  const s = String(v ?? '').trim()
  return s || undefined
}

function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x).trim()).filter(Boolean)
}

function parseRequestedPageCount(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.floor(v)
    return n > 0 ? n : undefined
  }
  const raw = String(v ?? '').trim()
  if (!raw) return undefined
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function inferRequestedPageCountFromPrompt(prompt: string): number | undefined {
  const text = prompt.toLowerCase()
  const patterns = [
    /\b(?:exactamente|justo|solo|únicamente)\s+(\d{1,2})\s+p[aá]ginas?\b/i,
    /\b(\d{1,2})\s+p[aá]ginas?\s+(?:exactas|en total)\b/i,
    /\b(?:con|de)\s+(\d{1,2})\s+p[aá]ginas?\b/i,
    /\b(\d{1,2})\s+pages?\b/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const candidate = Number.parseInt(match?.[1] ?? '', 10)
    if (Number.isFinite(candidate) && candidate > 0) return candidate
  }
  return undefined
}

const SITE_TYPE_LABELS: Record<DesignSiteType, string> = {
  landing: 'Landing / marketing',
  ecommerce: 'E-commerce / tienda',
  portfolio: 'Portafolio / showcase',
  dashboard: 'Dashboard / app',
  blog: 'Blog / editorial',
  saas: 'SaaS / producto B2B',
}

/** Infiere campos del brief a partir del prompt cuando el cliente no envía brief explícito. */
export function inferDesignBriefFromPrompt(prompt: string): Partial<DesignBrief> {
  const lower = prompt.toLowerCase()
  const inferred: Partial<DesignBrief> = {}

  if (/\b(e-?commerce|tienda|shop|catálogo|catalogo|productos)\b/i.test(lower)) {
    inferred.siteType = 'ecommerce'
  } else if (/\b(portfolio|portafolio|showcase|galería)\b/i.test(lower)) {
    inferred.siteType = 'portfolio'
  } else if (/\b(dashboard|panel|admin|saas|app)\b/i.test(lower)) {
    inferred.siteType = /\bsaas\b/i.test(lower) ? 'saas' : 'dashboard'
  } else if (/\b(blog|artículos|noticias|magazine)\b/i.test(lower)) {
    inferred.siteType = 'blog'
  } else if (/\b(landing|startup|marketing)\b/i.test(lower)) {
    inferred.siteType = 'landing'
  }

  if (
    /\b(coche|coches|auto|autos|automóvil|automovil|vehículo|vehiculo|automotriz|concesionario|motor|deportivo)\b/i.test(
      lower,
    )
  ) {
    inferred.brandTone = inferred.brandTone ?? 'automotriz premium cinematográfico'
    inferred.siteType = inferred.siteType ?? 'ecommerce'
  } else if (
    /\b(ferreter[ií]a|ferreteria|hardware|herramienta|constructor|construcci[oó]n|bricolaje)\b/i.test(
      lower,
    )
  ) {
    inferred.brandTone = inferred.brandTone ?? 'práctico y robusto'
    inferred.siteType = inferred.siteType ?? 'ecommerce'
  } else if (/\b(restaurante|comida|gastronom|chef|menú|menu)\b/i.test(lower)) {
    inferred.brandTone = inferred.brandTone ?? 'gastronómico cálido'
  } else if (/\b(moda|fashion|boutique|lujo|luxury|joyería|joyeria)\b/i.test(lower)) {
    inferred.brandTone = inferred.brandTone ?? 'editorial de lujo'
  } else if (/\b(corporativ|profesional|enterprise|b2b)\b/i.test(lower)) {
    inferred.brandTone = inferred.brandTone ?? 'corporativo sofisticado'
  } else if (/\b(rebelde|punk|cyberpunk|underground|raw)\b/i.test(lower)) {
    inferred.brandTone = inferred.brandTone ?? 'rebelde / vanguardista'
  } else if (/\b(minimal|limpio|elegante|premium|lujo)\b/i.test(lower)) {
    inferred.brandTone = inferred.brandTone ?? 'minimalista premium'
  } else if (/\b(brutalist|brutalismo)\b/i.test(lower)) {
    inferred.brandTone = inferred.brandTone ?? 'brutalista'
  }

  const sections: string[] = []
  if (/\b(precio|pricing|planes)\b/i.test(lower)) sections.push('pricing')
  if (/\b(testimonial|reseñas|reviews)\b/i.test(lower)) sections.push('testimonials')
  if (/\b(faq|preguntas)\b/i.test(lower)) sections.push('faq')
  if (/\b(contacto|contact)\b/i.test(lower)) sections.push('contact')
  if (sections.length) inferred.requiredSections = sections
  const requestedPageCount = inferRequestedPageCountFromPrompt(prompt)
  if (requestedPageCount) inferred.requestedPageCount = requestedPageCount

  return inferred
}

export function mergeDesignBrief(
  explicit: DesignBrief,
  inferred?: Partial<DesignBrief>,
): DesignBrief {
  return {
    prompt: explicit.prompt,
    businessModel: explicit.businessModel ?? inferred?.businessModel,
    brandTone: explicit.brandTone ?? inferred?.brandTone,
    siteType: explicit.siteType ?? inferred?.siteType,
    requestedPageCount: explicit.requestedPageCount ?? inferred?.requestedPageCount,
    requiredSections:
      explicit.requiredSections?.length
        ? explicit.requiredSections
        : inferred?.requiredSections,
    stitchProjectId: explicit.stitchProjectId ?? inferred?.stitchProjectId,
    stitchScreenId: explicit.stitchScreenId ?? inferred?.stitchScreenId,
    locale: explicit.locale ?? inferred?.locale,
  }
}

/** Bloque de contexto inyectado en todas las fases de orquestación. */
export function composeDesignBriefBlock(brief: DesignBrief): string {
  const lines = ['## Brief estructurado', `- Descripción: ${brief.prompt}`]
  if (brief.businessModel) lines.push(`- Modelo de negocio: ${brief.businessModel}`)
  if (brief.brandTone) lines.push(`- Tono de marca: ${brief.brandTone}`)
  if (brief.siteType) lines.push(`- Tipo de sitio: ${SITE_TYPE_LABELS[brief.siteType]}`)
  if (brief.requestedPageCount && brief.requestedPageCount > 0) {
    lines.push(`- Cantidad exacta de páginas: ${brief.requestedPageCount}`)
  }
  if (brief.requiredSections?.length) {
    lines.push(`- Secciones obligatorias: ${brief.requiredSections.join(', ')}`)
  }
  return lines.join('\n')
}

export function composeOrchestrationUserPrompt(
  brief: DesignBrief,
  extraBlocks: string[] = [],
): string {
  const locale = resolveOrchestrationLocale(brief)
  return [
    composeDesignBriefBlock(brief),
    orchestrationLocalePromptRules(locale),
    ...extraBlocks,
  ]
    .filter(Boolean)
    .join('\n\n')
}

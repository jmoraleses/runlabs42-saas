import type { StitchDesignType } from '@/lib/auto/stitch/stitchDesignType'

/** Máximo de pantallas por proyecto en auto topics / Stitch Playwright. */
export const AUTO_TOPIC_MAX_SCREENS_LIMIT = 16
export const AUTO_TOPIC_DEFAULT_MAX_SCREENS = 8

const STITCH_SCOPE_SUFFIX = /\n\n\[Alcance Stitch:[\s\S]*\]$/i

export function clampTopicMaxScreens(value: unknown): number {
  const n = Math.round(Number(value) || AUTO_TOPIC_DEFAULT_MAX_SCREENS) || AUTO_TOPIC_DEFAULT_MAX_SCREENS
  return Math.max(1, Math.min(n, AUTO_TOPIC_MAX_SCREENS_LIMIT))
}

export function stripStitchScope(prompt: string): string {
  return String(prompt ?? '')
    .replace(STITCH_SCOPE_SUFFIX, '')
    .trim()
}

export function buildStitchScopeBlock(opts: {
  maxScreens: number
  designType: StitchDesignType
}): string {
  const n = clampTopicMaxScreens(opts.maxScreens)
  const product =
    opts.designType === 'web'
      ? 'sitio web responsive (desktop y móvil), no app nativa'
      : 'aplicación móvil nativa, no sitio web de escritorio'
  const pages =
    n === 1
      ? 'una sola pantalla de inicio o landing completa'
      : `exactamente ${n} pantallas de diseño coherentes entre sí (p. ej. inicio, catálogo o listado, detalle de producto, carrito o checkout, cuenta, contacto o FAQ, según el tipo de producto indicado arriba)`
  return `[Alcance Stitch: ${product}; ${pages}. No generes menos pantallas de las indicadas.]`
}

/** Añade tipo de producto (web/app) y recuento de pantallas al prompt para Stitch. */
export function enrichTopicPromptForStitch(opts: {
  prompt: string
  maxScreens: number
  designType: StitchDesignType
}): string {
  const base = stripStitchScope(opts.prompt)
  const scope = buildStitchScopeBlock(opts)
  if (!base) return scope
  return `${base}\n\n${scope}`
}

export function topicListSystemPrompt(maxScreens: number): string {
  const n = clampTopicMaxScreens(maxScreens)
  return `Generas listas de topics/nichos para crear webs.
Devuelve SOLO JSON válido con este formato exacto:
{"items":[{"topic":"...","prompt":"..."}]}
Reglas:
- 10 elementos
- topic en español, máximo 12 palabras (nombre corto del tema)
- prompt en español, 1-2 frases (20-40 palabras) listas para Google Stitch como instrucción de diseño
- cada prompt DEBE nombrar explícitamente el tipo de producto (tienda online, blog, marketplace, SaaS, portfolio, web de servicios, app de reservas, etc.), el público objetivo y el estilo visual
- NO incluyas el bloque [Alcance Stitch] ni el número de pantallas en el prompt (se añade después con ${n} pantallas)
- no repetir topics
- sin markdown ni comillas dobles dentro de los strings`
}

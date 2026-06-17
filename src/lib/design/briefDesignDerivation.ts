import type { DesignBrief } from '@/lib/design/designBrief'
import { colorDistanceRgb } from '@/lib/design/visualPaletteCompare'
import { m3PaletteFromBrief } from '@/lib/design/stitchDesignMdPalette'
import { shiftHue } from '@/lib/design/themeTokens'

const HEX_IN_TEXT = /#([0-9a-fA-F]{6})\b/g

const NAMED_COLOR_HINTS: Array<{ pattern: RegExp; hex: string }> = [
  { pattern: /\b(amarillo|yellow|dorado|gold|pollito)\b/i, hex: '#ffd700' },
  { pattern: /\b(naranja|orange|mandarina)\b/i, hex: '#ea580c' },
  { pattern: /\b(rojo|red|coral|granate)\b/i, hex: '#dc2626' },
  { pattern: /\b(rosa|pink|magenta|fucsia)\b/i, hex: '#db2777' },
  { pattern: /\b(morado|purple|violeta|violet)\b/i, hex: '#7c3aed' },
  { pattern: /\b(azul|blue|navy|marino)\b/i, hex: '#2563eb' },
  { pattern: /\b(verde|green|esmeralda|forest)\b/i, hex: '#16a34a' },
  { pattern: /\b(teal|turquesa|cyan)\b/i, hex: '#0d9488' },
  { pattern: /\b(crema|cream|beige|arena|ivory)\b/i, hex: '#fff8f0' },
  { pattern: /\b(negro|black|oscuro|dark)\b/i, hex: '#171717' },
  { pattern: /\b(blanco|white|claro)\b/i, hex: '#fafafa' },
]

/** Contexto de sector/producto inferido del texto del brief (sin imagen). */
export type PromptDesignContext = {
  industry: string
  colorDirection: string
  typographyDirection: string
  layoutDirection: string
  antiPatterns: string[]
  seedOverride?: string
  layoutStyle?: string
  typography?: BriefTypographyPair
  brandTone?: string
}

const INDUSTRY_CONTEXTS: Array<{
  pattern: RegExp
  ctx: Omit<PromptDesignContext, 'industry'> & { industry: string }
}> = [
  {
    pattern:
      /\b(coche|coches|auto|autos|automóvil|automovil|vehículo|vehiculo|automotriz|concesionario|motor|deportivo|suv|eléctrico|electrico|flota)\b/i,
    ctx: {
      industry: 'automotriz',
      seedOverride: '#171717',
      layoutStyle: 'magazine',
      typography: { heading: 'Bebas Neue', body: 'Inter' },
      brandTone: 'automotriz premium cinematográfico',
      colorDirection:
        'Paleta oscura o metalizada (carbono, grafito, plata); acento en rojo deportivo, cobre o azul petróleo — NO azul corporativo SaaS (#2563eb).',
      typographyDirection:
        'Display condensada o serif elegante (Bebas Neue, Oswald, Cormorant) + sans neutra para UI.',
      layoutDirection:
        'Hero full-bleed con vehículo dominante, bandas de especificaciones, grid asimétrico de modelos, CTA de reserva/prueba — NO landing SaaS blanca con 3 iconos.',
      antiPatterns: [
        'fondo blanco plano con botones azules tipo startup',
        'hero genérico “3 beneficios” sin contexto motor',
      ],
    },
  },
  {
    pattern: /\b(restaurante|comida|gastronom|chef|menú|menu|bar\b|cocina|receta)\b/i,
    ctx: {
      industry: 'gastronomía',
      seedOverride: '#92400e',
      layoutStyle: 'organic',
      typography: { heading: 'Playfair Display', body: 'Lato' },
      brandTone: 'gastronómico cálido',
      colorDirection: 'Tierras, terracota, crema, verde oliva o vino — evita azul tech.',
      typographyDirection: 'Serif editorial + sans humanista legible.',
      layoutDirection:
        'Hero con plato o ambiente, carta en módulos, reservas — no dashboard SaaS.',
      antiPatterns: ['paleta azul corporativa', 'grid de features con iconos lineales'],
    },
  },
  {
    pattern: /\b(salud|clínica|clinica|médic|medic|hospital|wellness|spa|fitness|gym|yoga)\b/i,
    ctx: {
      industry: 'salud y bienestar',
      seedOverride: '#0d9488',
      layoutStyle: 'organic',
      typography: { heading: 'Outfit', body: 'Source Sans 3' },
      brandTone: 'calmado y confiable',
      colorDirection: 'Verdes suaves, teal, azul agua o lavanda — no negro duro ni neón agresivo.',
      typographyDirection: 'Sans redondeada o humanista, jerarquía clara.',
      layoutDirection: 'Hero tranquilizador, bloques de servicios, prueba social, CTA de cita.',
      antiPatterns: ['estética fintech oscura', 'botones azul brillante genéricos'],
    },
  },
  {
    pattern: /\b(moda|fashion|boutique|ropa|zapatos|luxury|lujo|joyería|joyeria|reloj)\b/i,
    ctx: {
      industry: 'moda y lujo',
      seedOverride: '#0a0a0a',
      layoutStyle: 'magazine',
      typography: { heading: 'Cormorant Garamond', body: 'Montserrat' },
      brandTone: 'editorial de lujo',
      colorDirection: 'Negro, marfil, dorado o burdeos; mucho espacio negativo.',
      typographyDirection: 'Serif de alto contraste + sans minimal.',
      layoutDirection: 'Lookbook, grids editoriales, tipografía grande — no cards SaaS.',
      antiPatterns: ['landing startup azul', 'ilustraciones flat coloridas'],
    },
  },
  {
    pattern: /\b(crypto|web3|blockchain|nft|defi)\b/i,
    ctx: {
      industry: 'web3',
      seedOverride: '#6366f1',
      layoutStyle: 'brutalist',
      typography: { heading: 'Space Grotesk', body: 'IBM Plex Sans' },
      brandTone: 'futurista rebelde',
      colorDirection: 'Fondo oscuro, acentos neón (violeta, cian, lima).',
      typographyDirection: 'Sans geométrica o display tech.',
      layoutDirection: 'Hero con gradiente mesh, métricas, CTA wallet — no corporate light.',
      antiPatterns: ['sitio blanco corporativo', 'azul Microsoft'],
    },
  },
  {
    pattern:
      /\b(ferreter[ií]a|ferreteria|hardware|herramienta|herramientas|constructor|construcci[oó]n|bricolaje|diy|tornillo|cemento|pintura|plomer[ií]a|electricidad|material(es)?\s+de\s+construcci[oó]n)\b/i,
    ctx: {
      industry: 'ferretería / construcción',
      seedOverride: '#ea580c',
      layoutStyle: 'minimalist',
      typography: { heading: 'Barlow Condensed', body: 'Roboto' },
      brandTone: 'práctico y robusto',
      colorDirection:
        'Naranja industrial, amarillo seguridad, azul herramienta o gris cemento — PROHIBIDO lavanda/morado/violeta SaaS en fondos y CTAs.',
      typographyDirection: 'Sans condensada o robusta (Barlow, Archivo, Roboto) — legible en catálogo denso.',
      layoutDirection:
        'Header con categorías de producto, hero de ofertas, grid utilitario de productos, confianza (envío/stock) — tienda de barrio profesional, no startup púrpura.',
      antiPatterns: [
        'fondos lavanda o morado claro',
        'estética fintech/SaaS con gradientes violetas',
        'landing genérica de 3 iconos',
      ],
    },
  },
  {
    pattern: /\b(inmobiliaria|inmueble|apartamento|vivienda|real\s*estate|propiedad)\b/i,
    ctx: {
      industry: 'inmobiliaria',
      seedOverride: '#1e3a5f',
      layoutStyle: 'minimalist',
      typography: { heading: 'DM Serif Display', body: 'Work Sans' },
      brandTone: 'confiable y aspiracional',
      colorDirection: 'Azul profundo, arena, blanco roto — acento cobre o verde bosque.',
      typographyDirection: 'Serif elegante + sans neutra.',
      layoutDirection: 'Buscador destacado, grid de propiedades, mapa o filtros visibles.',
      antiPatterns: ['hero SaaS con 3 bullets genéricos sin listados'],
    },
  },
]

const SITE_TYPE_SEEDS: Partial<Record<NonNullable<DesignBrief['siteType']>, string[]>> = {
  saas: ['#1e40af', '#0f766e', '#4338ca'],
  dashboard: ['#1e3a5f', '#334155', '#0f766e'],
  portfolio: ['#7c3aed', '#be185d', '#0d9488'],
  blog: ['#b45309', '#854d0e', '#9a3412'],
  landing: ['#0f766e', '#0369a1', '#7c2d12'],
  ecommerce: ['#ea580c', '#1e3a5f', '#ca8a04', '#134e4a', '#854d27', '#dc2626', '#0f766e'],
}

/** Primarios que el modelo suele repetir aunque el brief sea otro sector. */
export const GENERIC_SAAS_TEMPLATE_PRIMARIES = new Set([
  '#2563eb',
  '#3b82f6',
  '#4f46e5',
  '#6366f1',
  '#7c3aed',
  '#8b5cf6',
  '#9333ea',
  '#a855f7',
  '#581c87',
  '#6d28d9',
  '#c084fc',
  '#ddd6fe',
  '#ede9fe',
  '#f5f3ff',
])

const VARIED_SEEDS = [
  '#ea580c',
  '#1e3a5f',
  '#dc2626',
  '#0d9488',
  '#ca8a04',
  '#854d27',
  '#16a34a',
  '#b45309',
]

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

function briefText(brief: DesignBrief): string {
  return [brief.prompt, brief.brandTone, brief.businessModel].filter(Boolean).join(' ')
}

/** Extrae el primer hex explícito del brief (#RRGGBB). */
export function extractHexFromBrief(brief: DesignBrief): string | undefined {
  const text = briefText(brief)
  const match = text.match(HEX_IN_TEXT)
  if (match?.[0]) return `#${match[0].slice(1).toLowerCase()}`
  return undefined
}

/** Sector y dirección creativa inferidos solo del texto del prompt. */
export function derivePromptDesignContext(brief: DesignBrief): PromptDesignContext | null {
  const text = briefText(brief)
  if (!text.trim()) return null
  for (const { pattern, ctx } of INDUSTRY_CONTEXTS) {
    if (pattern.test(text)) return { ...ctx }
  }
  return null
}

/** Bloques de identidad/paleta para fases sin captura adjunta. */
export function orchestrationTextOnlyIdentityBlocks(
  brief: DesignBrief,
  hasVisualReference: boolean,
): string[] {
  if (hasVisualReference) return []
  return [promptDerivedDesignIdentityBlock(brief)]
}

/** ¿El primary del modelo se aleja de la semilla del brief o es cliché SaaS/morado? */
export function shouldAlignDesignMdColorsToBrief(
  modelPrimary: string | undefined,
  brief: DesignBrief,
): boolean {
  const expected = seedColorFromBrief(brief)
  const explicit = extractHexFromBrief(brief)
  if (!modelPrimary?.trim()) return true

  const model = modelPrimary.trim().toLowerCase()
  if (explicit && colorDistanceRgb(model, explicit) <= 40) return false

  if (GENERIC_SAAS_TEMPLATE_PRIMARIES.has(model)) {
    return colorDistanceRgb(model, expected) > 35
  }

  const industry = derivePromptDesignContext(brief)
  if (industry) return colorDistanceRgb(model, expected) > 42

  return colorDistanceRgb(model, expected) > 58
}

/** Bloque inyectado en orquestación cuando no hay imagen de referencia. */
export function promptDerivedDesignIdentityBlock(brief: DesignBrief): string {
  const ctx = derivePromptDesignContext(brief)
  const palette = m3PaletteFromBrief(brief)
  const typo = ctx?.typography ?? typographyForBrief(brief)
  const layoutStyle = ctx?.layoutStyle ?? layoutStyleFromBrief(brief)
  const lines = [
    '## Identidad visual obligatoria (contexto del prompt — sin plantilla fija)',
    `- Producto / sector: ${brief.prompt.trim().slice(0, 280)}`,
  ]
  if (ctx) {
    lines.push(
      `- Sector inferido: **${ctx.industry}**`,
      `- Dirección cromática: ${ctx.colorDirection}`,
      `- Tipografía: ${ctx.typographyDirection} (sugerencia: ${typo.heading} + ${typo.body})`,
      `- Estructura: ${ctx.layoutDirection}`,
      `- layoutStyle: ${layoutStyle}`,
      `- Anti-patrones PROHIBIDOS: ${ctx.antiPatterns.join('; ')}`,
    )
  } else {
    lines.push(
      `- layoutStyle: ${layoutStyle}`,
      `- Tipografía sugerida: ${typo.heading} + ${typo.body}`,
      `- Semilla cromática: ${palette.primary ?? seedColorFromBrief(brief)} (ajusta toda la paleta M3 a este producto, no a un SaaS genérico)`,
      '- PROHIBIDO: fondo blanco + botones azul #2563eb + Inter como default si el brief no describe un SaaS corporativo explícito.',
      '- La estructura (secciones, jerarquía, densidad) debe reflejar el tipo de negocio del prompt, no un landing de plantilla.',
    )
  }
  lines.push(
    briefPaletteGuidanceBlock(brief, palette),
    'Cada pantalla y token debe sentirse diseñado para ESTE producto; si el resultado parece un template de internet, rehazlo.',
  )
  return lines.join('\n')
}

/** Color semilla determinista a partir del brief (hex, nombre de color, tipo de sitio o hash). */
export function seedColorFromBrief(brief: DesignBrief): string {
  const explicit = extractHexFromBrief(brief)
  if (explicit) return explicit

  const text = briefText(brief)
  const industry = derivePromptDesignContext(brief)
  if (industry?.seedOverride) {
    return industry.seedOverride
  }

  for (const { pattern, hex } of NAMED_COLOR_HINTS) {
    if (pattern.test(text)) return hex
  }

  if (brief.siteType && SITE_TYPE_SEEDS[brief.siteType]) {
    const pool = SITE_TYPE_SEEDS[brief.siteType]!
    const base = pool[hashString(brief.prompt) % pool.length]!
    return varySeedHueForBrief(base, brief, { allowJitter: true })
  }

  const base = VARIED_SEEDS[hashString(text || brief.prompt) % VARIED_SEEDS.length]!
  return varySeedHueForBrief(base, brief, { allowJitter: true })
}

/**
 * Pequeño giro de matiz para que prompts distintos no compartan siempre la misma paleta M3,
 * sin romper colores nombrados o #hex explícitos en el brief.
 */
export function varySeedHueForBrief(
  seed: string,
  brief: DesignBrief,
  opts?: { allowJitter?: boolean },
): string {
  if (!opts?.allowJitter) return seed
  const text = briefText(brief)
  if (extractHexFromBrief(brief)) return seed
  for (const { pattern } of NAMED_COLOR_HINTS) {
    if (pattern.test(text)) return seed
  }
  const h = hashString(text || brief.prompt)
  const degrees = (h % 56) - 28
  if (degrees === 0) return seed
  return shiftHue(seed, degrees, 1, 1)
}

/** Bloque de prompt: paleta obligatoria derivada del brief (evita paletas genéricas). */
export function briefPaletteGuidanceBlock(brief: DesignBrief, palette: Record<string, string>): string {
  const seed = seedColorFromBrief(brief)
  const primary = palette.primary ?? seed
  const surface = palette.surface ?? palette.background ?? '#fafafa'
  const secondary = palette.secondary ?? primary
  return [
    '## Paleta obligatoria (derivada del brief — NO sustituir por plantilla fija)',
    `Semilla cromática: ${seed}. primary: ${primary}. surface/background: ${surface}. secondary: ${secondary}.`,
    'Los hex de `colors:` en el YAML deben ser coherentes con esta semilla y el producto del brief.',
    'PROHIBIDO reutilizar paletas genéricas del sistema salvo que el brief o la imagen lo pidan.',
  ].join('\n')
}

export type BriefTypographyPair = { heading: string; body: string }

const TYPOGRAPHY_BY_TONE: Array<{ pattern: RegExp; pair: BriefTypographyPair }> = [
  {
    pattern: /\b(quick\s*sand|quicksand|pollito|infantil|juguetón|playful|friendly)\b/i,
    pair: { heading: 'Quicksand', body: 'Nunito' },
  },
  {
    pattern: /\b(organic|botanical|orgánico|editorial|playfair|planta|garden)\b/i,
    pair: { heading: 'Playfair Display', body: 'Montserrat' },
  },
  {
    pattern: /\b(brutalist|brutalismo|brutal)\b/i,
    pair: { heading: 'Space Grotesk', body: 'IBM Plex Sans' },
  },
  {
    pattern: /\b(cyberpunk|rebelde|futur|neon|tech noir)\b/i,
    pair: { heading: 'Orbitron', body: 'Roboto' },
  },
  {
    pattern: /\b(corporativ|enterprise|b2b|formal|sofisticad)\b/i,
    pair: { heading: 'DM Sans', body: 'Inter' },
  },
  {
    pattern: /\b(lujo|luxury|premium|elegant|refinad)\b/i,
    pair: { heading: 'Cormorant Garamond', body: 'Lato' },
  },
  {
    pattern: /\b(tech|startup|saas|modern|minimal)\b/i,
    pair: { heading: 'Syne', body: 'Inter' },
  },
  {
    pattern: /\b(retro|vintage|nostalg)\b/i,
    pair: { heading: 'Libre Baskerville', body: 'Source Sans 3' },
  },
]

const VARIED_TYPOGRAPHY: BriefTypographyPair[] = [
  { heading: 'Fraunces', body: 'Source Sans 3' },
  { heading: 'DM Serif Display', body: 'Work Sans' },
  { heading: 'Outfit', body: 'Inter' },
  { heading: 'Bitter', body: 'Open Sans' },
  { heading: 'Sora', body: 'Nunito Sans' },
  { heading: 'Archivo', body: 'Roboto Flex' },
]

/** Tipografías Google Fonts derivadas del brief (no plantilla fija). */
export function typographyForBrief(brief: DesignBrief): BriefTypographyPair {
  const industry = derivePromptDesignContext(brief)
  if (industry?.typography) return industry.typography

  const text = briefText(brief)
  for (const { pattern, pair } of TYPOGRAPHY_BY_TONE) {
    if (pattern.test(text)) return pair
  }
  return VARIED_TYPOGRAPHY[hashString(brief.prompt) % VARIED_TYPOGRAPHY.length]!
}

export function layoutStyleFromBrief(brief: DesignBrief): string {
  const industry = derivePromptDesignContext(brief)
  if (industry?.layoutStyle) return industry.layoutStyle

  const tone = brief.brandTone?.toLowerCase() ?? ''
  const text = briefText(brief).toLowerCase()
  if (/brutalist|brutalismo/i.test(tone)) return 'brutalist'
  if (/organic|botanical|orgánico|planta|verdant|garden|botan/i.test(tone)) return 'organic'
  if (/\bbento\b/i.test(tone)) return 'bento'
  if (brief.siteType === 'blog' || /\bmagazine|editorial\b/i.test(tone)) return 'magazine'
  if (/\b(asymmetric|asimétric|bento|editorial|cinematogr|full-?bleed)\b/i.test(text)) {
    return 'asymmetric-grid'
  }
  if (brief.siteType === 'ecommerce' && /\b(lujo|premium|deportivo|automotriz)\b/i.test(text)) {
    return 'magazine'
  }
  return 'minimalist'
}

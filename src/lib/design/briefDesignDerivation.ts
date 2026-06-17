import type { DesignBrief } from '@/lib/design/designBrief'
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

const SITE_TYPE_SEEDS: Partial<Record<NonNullable<DesignBrief['siteType']>, string[]>> = {
  saas: ['#1e40af', '#0f766e', '#4338ca'],
  dashboard: ['#1e3a5f', '#334155', '#0f766e'],
  portfolio: ['#7c3aed', '#be185d', '#0d9488'],
  blog: ['#b45309', '#854d0e', '#9a3412'],
  landing: ['#0f766e', '#0369a1', '#7c2d12'],
  ecommerce: ['#854d27', '#1e3a5f', '#7c2d12', '#134e4a', '#581c87', '#ca8a04'],
}

const VARIED_SEEDS = [
  '#2563eb',
  '#7c3aed',
  '#dc2626',
  '#0d9488',
  '#ca8a04',
  '#db2777',
  '#1e3a5f',
  '#854d27',
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

/** Color semilla determinista a partir del brief (hex, nombre de color, tipo de sitio o hash). */
export function seedColorFromBrief(brief: DesignBrief): string {
  const explicit = extractHexFromBrief(brief)
  if (explicit) return explicit

  const text = briefText(brief)
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
  const text = briefText(brief)
  for (const { pattern, pair } of TYPOGRAPHY_BY_TONE) {
    if (pattern.test(text)) return pair
  }
  return VARIED_TYPOGRAPHY[hashString(brief.prompt) % VARIED_TYPOGRAPHY.length]!
}

export function layoutStyleFromBrief(brief: DesignBrief): string {
  const tone = brief.brandTone?.toLowerCase() ?? ''
  if (/brutalist|brutalismo/i.test(tone)) return 'brutalist'
  if (/organic|botanical|orgánico|planta|verdant|garden|botan/i.test(tone)) return 'organic'
  if (/\bbento\b/i.test(tone)) return 'bento'
  if (brief.siteType === 'blog' || /\bmagazine|editorial\b/i.test(tone)) return 'magazine'
  return 'minimalist'
}

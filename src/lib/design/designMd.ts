import { parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'
import type { DesignBrief } from '@/lib/design/designBrief'
import {
  envelopeFromModelJson,
  envelopeToTokensJson,
  mergeOrchestrationEnvelopes,
  orchestrationEnvelopeHasContent,
  type OrchestrationTokenEnvelope,
} from '@/lib/design/normalizeDesignTokens'
import { DESIGN_SPEC_MD, DESIGN_THEME_CSS_PATH } from '@/lib/design/types'

export { DESIGN_THEME_CSS_PATH }
import {
  layoutStyleFromBrief,
  shouldAlignDesignMdColorsToBrief,
  typographyForBrief,
} from '@/lib/design/briefDesignDerivation'
import { m3PaletteFromBrief } from '@/lib/design/stitchDesignMdPalette'
import {
  isStitchParityEnabled,
  stitchDesignMdHtmlGuidanceBlocks,
} from '@/lib/design/stitchParity'
import { extractDesignMdSection } from '@/lib/design/designMdSections'
import {
  designMdPhotographyGuidanceBlock,
  photographyStyleFromBrief,
} from '@/lib/design/designPhotographyStyle'

export const REQUIRED_DESIGN_MD_SECTIONS = [
  '## Brand & Style',
  '## Colors',
  '## Typography',
  '## Layout & Spacing',
  '## Elevation & Depth',
  '## Shapes',
  '## Photography & Imagery',
  '## Components',
] as const

const DESIGN_MD_PLACEHOLDER_COLORS = `  primary: '#??????'
  on-primary: '#??????'
  primary-container: '#??????'
  on-primary-container: '#??????'
  secondary: '#??????'
  on-secondary: '#??????'
  secondary-container: '#??????'
  on-secondary-container: '#??????'
  tertiary: '#??????'
  on-tertiary: '#??????'
  surface: '#??????'
  on-surface: '#??????'
  surface-container: '#??????'
  outline: '#??????'
  background: '#??????'
  on-background: '#??????'
  error: '#ba1a1a'
  on-error: '#ffffff'`

const DESIGN_MD_PLACEHOLDER_TYPO = `typography:
  display-lg:
    fontFamily: Familia display/hero (Google Fonts real — puede ser diferente a headline)
    fontSize: 56px
    fontWeight: '700'
    lineHeight: '1.1'
  headline-lg:
    fontFamily: Familia titulares (Google Fonts real)
    fontSize: 36px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Familia titulares (misma que headline-lg o variante)
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-md:
    fontFamily: Familia body/UI (Google Fonts real — diferente a heading si el diseño lo usa)
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Familia label (puede ser la misma que body o una tercera familia sans)
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  DEFAULT: 0.5rem
spacing:
  unit: 8px
  container-margin: 24px
  gutter: 24px`

/** Instrucción del agente: generar spec/design.md estilo Google Stitch (YAML M3 + narrativa densa). */
export function designMdSystemInstruction(hasVisualReference = false): string {
  const visualColorNote =
    '\n(Incluye también surface-dim, surface-bright, surface-container-*, inverse-*, *-fixed, outline-variant, etc. con hex del brief o la imagen.)'

  const visualRules = hasVisualReference
    ? `
0. **IMAGEN ADJUNTA = fuente de verdad de color y estilo.** Antes de escribir YAML, identifica en la captura: hex de fondos, texto, CTAs, acentos; familias tipográficas; densidad y tono. PROHIBIDO copiar paletas genéricas del sistema — los colores y tipografías DEBEN extraerse de la imagen.
1. Frontmatter YAML completo entre --- con TODOS los tokens \`colors\` Material 3 (mismas claves que el esquema M3; valores hex SOLO de la imagen + brief).`
    : `0. **BRIEF = fuente de verdad.** Deriva nombre de estilo, hex y tipografías del producto descrito (sector, colores nombrados, #hex en el texto, tono de marca). PROHIBIDO reutilizar paletas de ejemplo del sistema ni el cliché SaaS (fondo blanco + primary azul #2563eb + Inter) salvo que el brief pida explícitamente un producto B2B/SaaS corporativo.
1. Frontmatter YAML completo entre --- con TODOS los tokens \`colors\` Material 3 (lista completa de claves M3; cada valor hex coherente con el brief y el tipo de negocio, sin plantilla fija).`

  const styleName = 'Nombre del estilo (2-5 palabras, específico del producto en brief/imagen)'

  return `Eres un director de arte y diseñador de sistemas de diseño web (estilo Google Stitch).
Tu PRIMERA y ÚNICA entrega es \`spec/design.md\`: fuente de verdad del producto (tokens + guía editorial) ANTES de layout o HTML.

Responde SOLO con un bloque:

\`\`\`markdown ${DESIGN_SPEC_MD}
---
name: ${styleName}
colors:
${DESIGN_MD_PLACEHOLDER_COLORS}${visualColorNote}
${DESIGN_MD_PLACEHOLDER_TYPO}
---

${REQUIRED_DESIGN_MD_SECTIONS.join('\n\n')}

(Cada sección: 2–4 párrafos o listas con reglas concretas del producto, no placeholders.)
\`\`\`

Reglas obligatorias:
${visualRules}
2. \`typography\`: al menos display-lg, headline-lg, headline-lg-mobile, headline-md, body-lg, body-md, label-md, label-sm — cada uno con fontFamily, fontSize, fontWeight, lineHeight. Una página puede usar 2–3 familias distintas: display-lg puede diferir de headline-lg, y body-md puede diferir de ambos. Asigna el fontFamily correcto a cada escala según su rol visual.
3. \`spacing\`: container-max, margin-mobile, base, gutter-desktop, gutter-mobile, margin-desktop, section-gap-lg, section-gap-md.
4. \`rounded\`: DEFAULT, lg, xl, full (0.25rem / 0.5rem / 0.75rem típico export Stitch).
5. Secciones markdown obligatorias: Brand & Style, Colors, Typography, Layout & Spacing, Elevation & Depth, Shapes, Components — texto específico del brief y la captura.
6. Paleta temática coherente con brief/imagen — no reutilices paletas de ejemplo del sistema; deriva colores del brief o de la imagen adjunta.
7. Tipografías reales de Google Fonts (las que veas o equivalentes cercanos). Usa nombres concretos (ej. "Cormorant Garamond", "DM Sans") — nunca "Serif" o "Sans-serif" como nombre de familia.
8. Sin comentarios inline en YAML (no uses \`# comentario\` tras los valores).
9. El HTML downstream usará Tailwind CDN + tailwind.config completo (colors, fontSize, fontFamily, spacing, borderRadius); no inventes segunda paleta.
10. NO generes JSON, HTML, layout ni lista de pantallas.`
}

/** Quita fences o prefijos que el modelo a veces deja dentro del cuerpo. */
function normalizeDesignMdExtract(raw: string): string {
  let md = raw.trim()
  md = md.replace(/^```(?:markdown)?\s*(?:spec\/)?design\.md\s*\n?/i, '')
  md = md.replace(/\n?```\s*$/i, '')
  return md.trim()
}

/** Extrae el contenido de spec/design.md desde la respuesta del modelo. */
export function parseDesignMdFromModelText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const ops = parseFileOperationsFromStream(trimmed)
  const fromFence = ops.find(
    (op) => op.type !== 'delete' && /design\.md$/i.test(op.path),
  )
  if (fromFence && fromFence.type !== 'delete' && fromFence.content.trim()) {
    return normalizeDesignMdExtract(fromFence.content)
  }

  const fencePatterns = [
    /```(?:markdown)?\s*spec\/design\.md\s*\n([\s\S]*?)```/i,
    /```(?:markdown)?\s*design\.md\s*\n([\s\S]*?)```/i,
    /```(?:markdown)?\s*\n([\s\S]*?)```/i,
  ]
  for (const re of fencePatterns) {
    const m = trimmed.match(re)
    const inner = m?.[1]?.trim()
    if (inner?.startsWith('---')) return normalizeDesignMdExtract(inner)
  }

  const openFence = trimmed.match(
    /```(?:markdown)?\s*(?:spec\/)?design\.md\s*\n([\s\S]+)$/i,
  )
  if (openFence?.[1]?.trim().startsWith('---')) {
    return normalizeDesignMdExtract(openFence[1])
  }

  const docMatch = trimmed.match(/---\r?\n[\s\S]*?\r?\n---[\s\S]*/)
  if (docMatch?.[0]?.trim()) return normalizeDesignMdExtract(docMatch[0])

  if (trimmed.startsWith('---')) return normalizeDesignMdExtract(trimmed)

  return null
}

/** Tokens por defecto cuando el modelo no devuelve design.md parseable. */
export function defaultEnvelopeFromBrief(brief: DesignBrief): OrchestrationTokenEnvelope {
  const palette = m3PaletteFromBrief(brief)
  const typo = typographyForBrief(brief)
  const concept =
    brief.brandTone?.trim() ||
    (brief.siteType ? `${brief.siteType} design` : 'Design system')

  return {
    brand: { concept, tone: brief.brandTone },
    tokens: {
      colors: { ...palette },
      typography: {
        heading: typo.heading,
        body: typo.body,
        baseSize: '16px',
        scale: '1.25',
      },
      ui: {
        borderRadius: '0.5rem',
        spacingUnit: '8px',
        layoutStyle: layoutStyleFromBrief(brief),
      },
    },
  }
}

export function buildDesignMdFromBrief(brief: DesignBrief): string {
  return buildStitchStyleDesignMd(defaultEnvelopeFromBrief(brief), brief)
}

export type ResolvedDesignMd = {
  designMd: string
  envelope: OrchestrationTokenEnvelope
  source: 'model-md' | 'model-json' | 'brief-fallback'
}

export type ResolveDesignMdOpts = {
  /** Con captura adjunta: no rellenar con plantilla derivada del brief (hash). */
  skipBriefFallback?: boolean
}

/** Nunca devuelve vacío: parsea markdown del modelo o aplica plantilla desde el brief. */
export function resolveDesignMdFromModel(
  mdText: string,
  brief: DesignBrief,
  opts?: ResolveDesignMdOpts,
): ResolvedDesignMd {
  const designMd = parseDesignMdFromModelText(mdText)
  if (designMd?.trim()) {
    const envelope = envelopeFromDesignMd(designMd)
    if (orchestrationEnvelopeHasContent(envelope)) {
      return {
        designMd,
        envelope,
        source: 'model-md',
      }
    }
    if (opts?.skipBriefFallback) {
      const partialEnv = mergeOrchestrationEnvelopes(
        envelope,
        envelopeFromModelJson(mdText),
      )
      return {
        designMd,
        envelope: orchestrationEnvelopeHasContent(partialEnv) ? partialEnv : envelope,
        source: 'model-md',
      }
    }
  }

  const fallbackEnv = envelopeFromModelJson(mdText)
  if (orchestrationEnvelopeHasContent(fallbackEnv)) {
    return {
      designMd: buildStitchStyleDesignMd(fallbackEnv, brief),
      envelope: fallbackEnv,
      source: 'model-json',
    }
  }

  if (opts?.skipBriefFallback) {
    const trimmed = designMd?.trim() || mdText.trim()
    return {
      designMd: trimmed,
      envelope: envelopeFromDesignMd(trimmed) ?? {},
      source: 'model-md',
    }
  }

  const briefEnv = defaultEnvelopeFromBrief(brief)
  return {
    designMd: buildStitchStyleDesignMd(briefEnv, brief),
    envelope: briefEnv,
    source: 'brief-fallback',
  }
}

interface YamlMap {
  [key: string]: string | YamlMap
}
type YamlValue = string | YamlMap

/** Parser YAML ligero para frontmatter de design.md (mapas de un nivel + anidados por indentación). */
export function parseYamlFrontmatter(markdown: string): Record<string, YamlValue> | null {
  let body = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]
  if (!body?.trim()) {
    body = markdown.match(/^---\r?\n([\s\S]+)$/)?.[1]
  }
  if (!body?.trim()) return null
  return parseSimpleYaml(body)
}

function parseSimpleYaml(source: string): Record<string, YamlValue> {
  const root: Record<string, YamlValue> = {}
  const stack: Array<{ indent: number; obj: Record<string, YamlValue> }> = [
    { indent: -1, obj: root },
  ]

  for (const line of source.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const indent = line.search(/\S/)
    const content = line.slice(indent).trim()
    const colon = content.indexOf(':')
    if (colon < 0) continue

    const key = content.slice(0, colon).trim()
    let valueRaw = content.slice(colon + 1).trim()
    const inlineComment = valueRaw.indexOf(' #')
    if (inlineComment >= 0) {
      valueRaw = valueRaw.slice(0, inlineComment).trim()
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop()
    }
    const parent = stack[stack.length - 1]!.obj

    if (!valueRaw) {
      const child: Record<string, YamlValue> = {}
      parent[key] = child
      stack.push({ indent, obj: child })
      continue
    }

    parent[key] = parseYamlScalar(valueRaw)
  }

  return root
}

function parseYamlScalar(raw: string): string {
  let v = raw.trim()
  const comment = v.indexOf(' #')
  if (comment >= 0) v = v.slice(0, comment).trim()
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1)
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1)
  if (v.startsWith("'")) return v.slice(1).trim()
  if (v.startsWith('"')) return v.slice(1).trim()
  return v
}

function assignMappedColor(
  target: Record<string, string>,
  key: string,
  ...candidates: (string | undefined)[]
): void {
  for (const value of candidates) {
    if (value?.trim()) {
      target[key] = value
      return
    }
  }
}

function asStringRecord(value: YamlValue | undefined): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

function asNestedStringRecord(
  value: YamlValue | undefined,
): Record<string, Record<string, string>> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, Record<string, string>> = {}
  for (const [k, v] of Object.entries(value)) {
    const inner = asStringRecord(v)
    if (inner) out[k] = inner
  }
  return Object.keys(out).length ? out : undefined
}

/** design.md con paleta M3, tipografía escalada y secciones narrativas (mínimo Stitch). */
export function designMdIsRichEnough(markdown: string): boolean {
  const fm = parseYamlFrontmatter(markdown)
  if (!fm || typeof fm.name !== 'string' || !fm.name.trim()) return false

  const colors = asStringRecord(fm.colors)
  const typography = asNestedStringRecord(fm.typography)
  if (!colors?.primary || !colors?.background || !colors?.['on-surface']) return false
  if (!colors?.['surface-container'] || !colors?.['primary-container']) return false

  const headline = typography?.['headline-lg']?.fontFamily
  const body = typography?.['body-md']?.fontFamily
  if (!headline?.trim() || !body?.trim()) return false

  const bodyMd = markdown.includes('\n---\n')
    ? markdown.slice(markdown.indexOf('\n---\n') + 5)
    : markdown
  const lower = bodyMd.toLowerCase()
  const sectionHits = REQUIRED_DESIGN_MD_SECTIONS.filter((h) =>
    lower.includes(h.toLowerCase()),
  ).length
  if (sectionHits < 5) return false

  const narrativeChars = bodyMd.replace(/^#+\s.*$/gm, '').replace(/\s/g, '').length
  return narrativeChars >= 400
}

/** Convierte spec/design.md (frontmatter) al envelope de tokens de orquestación. */
export function envelopeFromDesignMd(markdown: string): OrchestrationTokenEnvelope {
  const fm = parseYamlFrontmatter(markdown)
  if (!fm) return {}

  const name = typeof fm.name === 'string' ? fm.name : undefined
  const colors = asStringRecord(fm.colors)
  const typography = asNestedStringRecord(fm.typography)
  const rounded = asStringRecord(fm.rounded)
  const spacing = asStringRecord(fm.spacing)

  const mappedColors: Record<string, string> = {}
  if (colors) {
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        if (colors[k]) return colors[k]
      }
      return undefined
    }
    assignMappedColor(mappedColors, 'primary', pick('primary'), colors.primary)
    assignMappedColor(mappedColors, 'secondary', pick('secondary'), colors.secondary)
    assignMappedColor(mappedColors, 'tertiary', pick('tertiary'), colors.tertiary)
    assignMappedColor(
      mappedColors,
      'neutral',
      pick('neutral', 'surface-variant', 'outline-variant'),
    )
    assignMappedColor(
      mappedColors,
      'background',
      pick('background', 'surface-bright', 'surface'),
    )
    assignMappedColor(
      mappedColors,
      'surface',
      pick('surface', 'surface-container-low', 'surface-container'),
    )
    assignMappedColor(
      mappedColors,
      'text',
      pick('text', 'on-surface', 'on-background'),
    )
    assignMappedColor(
      mappedColors,
      'border',
      pick('border', 'outline', 'outline-variant'),
    )
    Object.assign(mappedColors, colors)
  }

  const headingFont =
    typography?.['headline-lg']?.fontFamily ??
    typography?.['display-lg']?.fontFamily ??
    typography?.headline?.fontFamily
  const bodyFont =
    typography?.['body-md']?.fontFamily ??
    typography?.['body-lg']?.fontFamily ??
    typography?.body?.fontFamily
  const labelFont =
    typography?.['label-md']?.fontFamily ??
    typography?.['label-sm']?.fontFamily ??
    bodyFont

  const borderRadius =
    rounded?.DEFAULT ?? rounded?.md ?? rounded?.lg ?? rounded?.sm
  const spacingUnit = spacing?.unit ?? '8px'

  let layoutStyle = 'minimalist'
  const lower = markdown.toLowerCase()
  if (/\bbrutalist|brutalismo\b/.test(lower)) layoutStyle = 'brutalist'
  else if (/\bbento\b/.test(lower)) layoutStyle = 'bento'
  else if (/\bmagazine|editorial\b/.test(lower)) layoutStyle = 'magazine'
  else if (/\borganic|botanical|orgánico\b/.test(lower)) layoutStyle = 'organic'

  return {
    brand: { concept: name },
    tokens: {
      colors: Object.keys(mappedColors).length ? mappedColors : undefined,
      typography: {
        ...(headingFont ? { heading: headingFont } : {}),
        ...(bodyFont ? { body: bodyFont } : {}),
        ...(labelFont ? { label: labelFont } : {}),
        baseSize: typography?.['body-md']?.fontSize ?? '16px',
        scale: '1.25',
      },
      ui: {
        ...(borderRadius ? { borderRadius } : {}),
        spacingUnit,
        layoutStyle,
      },
    },
  }
}

/**
 * Sustituye el bloque `colors:` del frontmatter por la paleta M3 derivada del brief
 * cuando el modelo devolvió un morado/azul SaaS genérico sin relación con el producto.
 */
export function alignDesignMdColorsToBrief(designMd: string, brief: DesignBrief): string {
  const trimmed = designMd.trim()
  const parts = trimmed.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)(\r?\n[\s\S]*)$/)
  if (!parts) return designMd

  const envelope = envelopeFromDesignMd(trimmed)
  const modelPrimary = envelope.tokens?.colors?.primary
  if (!shouldAlignDesignMdColorsToBrief(modelPrimary, brief)) return designMd

  const palette = m3PaletteFromBrief(brief)
  const colorsYaml = Object.entries(palette)
    .map(([k, v]) => `  ${k}: '${v}'`)
    .join('\n')

  let frontmatter = parts[2]!
  if (/^colors:\r?\n/m.test(frontmatter)) {
    frontmatter = frontmatter.replace(
      /^colors:\r?\n[\s\S]*?(?=^(?:typography|rounded|spacing):)/m,
      `colors:\n${colorsYaml}\n`,
    )
  } else {
    frontmatter = `colors:\n${colorsYaml}\n${frontmatter}`
  }

  const colorsSection = extractDesignMdSection(trimmed, '## Colors')
  const alignedColorsNarrative = [
    '## Colors',
    '',
    `- **Primary (${palette.primary}):** CTAs, enlaces de acción y acentos de marca derivados del brief.`,
    `- **Secondary / tertiary:** armonía M3 coherente con el producto — no reutilizar lavanda/morado SaaS genérico.`,
    `- **Surface / background:** lienzo y cards con tinte sutil del color semilla (${palette.surface}).`,
    'Usa los hex del frontmatter en Tailwind y en todos los botones.',
  ].join('\n')

  let body = parts[4] ?? ''
  if (colorsSection) {
    body = body.replace(colorsSection, alignedColorsNarrative)
  } else if (body.includes('## Brand & Style')) {
    body = body.replace(
      /(## Brand & Style[\s\S]*?)(\n## Typography)/,
      `$1\n\n${alignedColorsNarrative}$2`,
    )
  }

  return `${parts[1]}${frontmatter}${parts[3]}${body}`
}

/** Plantilla Stitch completa (YAML M3 + secciones) cuando el modelo no devuelve markdown válido. */
export function buildStitchStyleDesignMd(
  envelope: OrchestrationTokenEnvelope,
  brief: DesignBrief,
): string {
  const name =
    envelope.brand?.concept?.trim() ||
    (brief.brandTone ? `${brief.brandTone} design` : 'Design system')
  const typo = typographyForBrief(brief)
  const colors = {
    ...m3PaletteFromBrief(brief),
    ...envelope.tokens?.colors,
  }
  const heading = envelope.tokens?.typography?.heading ?? typo.heading
  const body = envelope.tokens?.typography?.body ?? typo.body
  const ui = envelope.tokens?.ui ?? {}
  const borderRadius = ui.borderRadius ?? '0.5rem'
  const layoutStyle = ui.layoutStyle ?? layoutStyleFromBrief(brief)
  const product = brief.prompt.trim().slice(0, 200)

  const yamlLines = [
    '---',
    `name: ${name}`,
    'colors:',
    ...Object.entries(colors).map(([k, v]) => `  ${k}: '${v}'`),
    'typography:',
    '  headline-xl:',
    `    fontFamily: ${heading}`,
    "    fontSize: 48px",
    "    fontWeight: '700'",
    "    lineHeight: 56px",
    "    letterSpacing: -0.02em",
    '  headline-xl-mobile:',
    `    fontFamily: ${heading}`,
    "    fontSize: 32px",
    "    fontWeight: '700'",
    "    lineHeight: 40px",
    "    letterSpacing: -0.02em",
    '  headline-lg:',
    `    fontFamily: ${heading}`,
    "    fontSize: 32px",
    "    fontWeight: '700'",
    "    lineHeight: 40px",
    '  headline-md:',
    `    fontFamily: ${heading}`,
    "    fontSize: 24px",
    "    fontWeight: '600'",
    "    lineHeight: 32px",
    '  body-lg:',
    `    fontFamily: ${body}`,
    "    fontSize: 18px",
    "    fontWeight: '500'",
    "    lineHeight: 28px",
    '  body-md:',
    `    fontFamily: ${body}`,
    "    fontSize: 16px",
    "    fontWeight: '500'",
    "    lineHeight: 24px",
    '  label-md:',
    `    fontFamily: ${body}`,
    "    fontSize: 14px",
    "    fontWeight: '600'",
    "    lineHeight: 20px",
    '    letterSpacing: 0.01em',
    '  label-sm:',
    `    fontFamily: ${body}`,
    "    fontSize: 12px",
    "    fontWeight: '700'",
    "    lineHeight: 16px",
    'rounded:',
    '  DEFAULT: 0.25rem',
    '  lg: 0.5rem',
    '  xl: 0.75rem',
    '  full: 9999px',
    'spacing:',
    '  container-max: 1280px',
    '  margin-mobile: 20px',
    `  base: ${ui.spacingUnit ?? '8px'}`,
    '  gutter-desktop: 24px',
    '  gutter-mobile: 16px',
    '  margin-desktop: 48px',
    '  section-gap-lg: 80px',
    '  section-gap-md: 48px',
    '---',
    '',
    '## Brand & Style',
    '',
    `El sistema **${name}** define la identidad visual para ${product}.`,
    brief.brandTone
      ? ` Tono de marca: ${brief.brandTone}. La interfaz debe reflejar ese tono en color, tipografía y ritmo espacial.`
      : ' Prioriza claridad, jerarquía tipográfica y coherencia cromática en todas las pantallas.',
    '',
    '## Colors',
    '',
    '- **Primary:** acciones principales, titulares de autoridad y texto de alto contraste.',
    '- **Secondary:** fondos suaves, chips informativos y contenedores de apoyo.',
    '- **Tertiary:** CTAs de conversión, badges de oferta y acentos cálidos puntuales.',
    '- **Surface / background:** lienzo principal coherente con la semilla cromática del brief.',
    'Usa tokens \`on-surface\`, \`outline\` y \`surface-container-*\` para capas y bordes sutiles.',
    '',
    '## Typography',
    '',
    `- **Display / headlines (${heading}):** titulares H1–H3 con sensación editorial.`,
    `- **Body / UI (${body}):** párrafos, descripciones de producto y controles.`,
    '- **Labels:** metadata, categorías y etiquetas de cuidado con letter-spacing ampliado.',
    '',
    '## Layout & Spacing',
    '',
    'Modelo híbrido fijo-fluido: contenedor máximo ~1280px en desktop, márgenes móviles ≥24px.',
    `Ritmo vertical: section-gap-lg (${ui.spacingUnit ? '80px' : '80px'}) entre bloques de homepage; grid 12 columnas en desktop.`,
    `Estilo de layout: ${layoutStyle}.`,
    '',
    '## Elevation & Depth',
    '',
    'Evita sombras pesadas. Profundidad por capas tonales (surface-container-*) y blur suave en navegación sticky (backdrop-filter ~12px, surface al 80% de opacidad).',
    'Hover en cards: sombra difusa baja opacidad (~15%) con blur ~20px.',
    '',
    '## Shapes',
    '',
    `- Radios estándar ${borderRadius} en botones, inputs y cards; 1rem en imágenes destacadas; pills full en badges.`,
    '',
    '## Photography & Imagery',
    '',
    photographyStyleFromBrief(brief),
    '- Todas las fotos del sitio (hero, productos, carrito, upsell) comparten la misma sesión de estudio: misma luz, fondo y gradación.',
    '- Evita mezclar exteriores luminosos con fondos oscuros moody en la misma pantalla.',
    '',
    '## Components',
    '',
    '**Botones:** primario con fondo primary y texto on-primary; secundario outline secondary; CTA de compra puede usar tertiary.',
    '**Cards:** padding generoso, borde 1px outline-variant, imagen de alta calidad arriba.',
    '**Inputs:** borde inferior o outline suave; focus en primary.',
    '**Chips:** fondo secondary-container, texto on-surface.',
  ]
  return yamlLines.join('\n')
}

/** @deprecated Usa buildStitchStyleDesignMd */
export function buildDesignMdFromEnvelope(
  envelope: OrchestrationTokenEnvelope,
  brief: DesignBrief,
): string {
  return buildStitchStyleDesignMd(envelope, brief)
}

export function designMdExcerpt(markdown: string, maxChars?: number): string {
  const trimmed = markdown.trim()
  if (maxChars == null || maxChars <= 0 || trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars)}\n\n…`
}

/** Lista de variables :root sugeridas desde el frontmatter colors de design.md. */
export function designMdCssRootVariableHints(markdown: string): string {
  const fm = parseYamlFrontmatter(markdown)
  const colors = fm?.colors
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) return ''
  const lines: string[] = []
  for (const [key, value] of Object.entries(colors as Record<string, YamlValue>)) {
    if (typeof value === 'string' && value.trim()) {
      const varName = key.replace(/[^a-z0-9-]/gi, '-')
      lines.push(`  --color-${varName}: ${value};`)
    }
  }
  const rounded = fm?.rounded
  if (rounded && typeof rounded === 'object' && !Array.isArray(rounded)) {
    for (const [key, value] of Object.entries(rounded as Record<string, YamlValue>)) {
      if (typeof value === 'string') {
        lines.push(`  --radius-${key === 'DEFAULT' ? 'default' : key}: ${value};`)
      }
    }
  }
  const spacing = fm?.spacing
  if (spacing && typeof spacing === 'object' && !Array.isArray(spacing)) {
    for (const [key, value] of Object.entries(spacing as Record<string, YamlValue>)) {
      if (typeof value === 'string') {
        lines.push(`  --spacing-${key}: ${value};`)
      }
    }
  }
  return lines.length ? `:root {\n${lines.join('\n')}\n}` : ''
}

export function designMdTypographyCssHints(markdown: string): string {
  const fm = parseYamlFrontmatter(markdown)
  const typo = fm?.typography
  if (!typo || typeof typo !== 'object' || Array.isArray(typo)) return ''
  const lines: string[] = []
  for (const [scale, def] of Object.entries(typo as Record<string, YamlValue>)) {
    if (def && typeof def === 'object' && !Array.isArray(def)) {
      const rec = def as Record<string, YamlValue>
      const family = typeof rec.fontFamily === 'string' ? rec.fontFamily : ''
      const size = typeof rec.fontSize === 'string' ? rec.fontSize : ''
      const weight = typeof rec.fontWeight === 'string' ? rec.fontWeight : ''
      if (family) {
        lines.push(
          `  --font-${scale}: ${family}${size ? `; /* ${size}${weight ? ` ${weight}` : ''} */` : ';'}`,
        )
      }
    }
  }
  return lines.length
    ? `/* Tipografía design.md */\n${lines.join('\n')}`
    : ''
}

/**
 * Bloques de prompt para que cada paso HTML respete spec/design.md.
 * @param partId shell | section-N | footer
 */
export function designMdHtmlGuidanceBlocks(
  markdown: string,
  partId?: string,
): string[] {
  const md = markdown.trim()
  if (!md) return []

  if (isStitchParityEnabled()) {
    return stitchDesignMdHtmlGuidanceBlocks(md, partId)
  }

  const blocks: string[] = [
    '## spec/design.md — FUENTE DE VERDAD (obligatorio en TODO el HTML)',
    'Los colores, tipografías, radios, espaciado, elevación y componentes DEBEN coincidir con design.md.',
    'Si tokens JSON y design.md difieren, **gana design.md**. No inventes paleta corporativa genérica.',
    designMdExcerpt(md),
    designMdPhotographyGuidanceBlock(md),
  ]

  const components = extractDesignMdSection(md, '## Components')
  const shapes = extractDesignMdSection(md, '## Shapes')
  const elevation = extractDesignMdSection(md, '## Elevation & Depth')
  const layoutGuide = extractDesignMdSection(md, '## Layout & Spacing')

  if (partId === 'shell') {
    const cssRoot = designMdCssRootVariableHints(md)
    const typo = designMdTypographyCssHints(md)
    blocks.push(
      '### Aplicar design.md en este paso (shell)',
      '- En `<style>`, define `:root` con **todas** las claves `colors` del frontmatter YAML como variables CSS.',
      '- `body`, `header`, `nav` y tipografía base usan las fuentes de `typography` (headline-lg, body-md, label-md).',
      '- Botones y nav según ## Components; border-radius según ## Shapes.',
      cssRoot ? `Ejemplo :root (adapta nombres pero conserva valores hex):\n\`\`\`css\n${cssRoot}\n\`\`\`` : '',
      typo ? typo : '',
      components ? `## Components\n${components}` : '',
    )
  } else if (partId === 'footer') {
    blocks.push(
      '### Aplicar design.md en este paso (footer)',
      '- Colores de superficie y texto según roles on-surface / outline-variant.',
      elevation ? `## Elevation & Depth\n${elevation}` : '',
      components ? `## Components\n${components}` : '',
    )
  } else if (partId === 'review') {
    blocks.push(
      '### Revisión visual (design.md)',
      '- Corrige solo estética y coherencia: colores :root, tipografías, radios, espaciado, jerarquía, CTAs.',
      '- Elimina bloques genéricos (Lorem, cards repetidas, gradientes fuera de paleta).',
      '- Mantén todos los data-sk-id; no elimines nodos editables.',
      components ? `## Components\n${components}` : '',
      layoutGuide ? `## Layout & Spacing\n${layoutGuide}` : '',
    )
  } else if (partId === 'full') {
    const cssRoot = designMdCssRootVariableHints(md)
    const typo = designMdTypographyCssHints(md)
    blocks.push(
      '### Aplicar design.md en el documento HTML completo (un solo paso)',
      '- Entrega UN único HTML con <!DOCTYPE>, <head><style> (:root con todos los hex del YAML), <body>, secciones del layout y <footer>.',
      '- Tipografía, botones, superficies y elevación según ## Components, ## Shapes y ## Elevation & Depth.',
      cssRoot ? `Ejemplo :root:\n\`\`\`css\n${cssRoot}\n\`\`\`` : '',
      typo ? typo : '',
      components ? `## Components\n${components}` : '',
      layoutGuide ? `## Layout & Spacing\n${layoutGuide}` : '',
      shapes ? `## Shapes\n${shapes}` : '',
      elevation ? `## Elevation & Depth\n${elevation}` : '',
    )
  } else if (partId?.startsWith('section-')) {
    blocks.push(
      '### Aplicar design.md en este paso (sección)',
      '- Colores de fondo, texto, CTAs y bordes: roles primary, secondary, tertiary, surface-container-* del YAML.',
      '- Tipografía: display/headline para títulos de bloque, body para párrafos, label para metadatos.',
      layoutGuide ? `## Layout & Spacing\n${layoutGuide}` : '',
      components ? `## Components\n${components}` : '',
      shapes ? `## Shapes\n${shapes}` : '',
    )
  }

  return blocks.filter((line) => line.trim().length > 0)
}

export const DESIGN_MD_THEME_STYLE_ID = 'runlabs42-design-theme'
export const DESIGN_MD_THEME_LINK_ID = 'runlabs42-design-fonts'

function collectFontFamiliesWithWeights(markdown: string): Map<string, Set<number>> {
  const familyWeights = new Map<string, Set<number>>()
  const addFamily = (name: string, weight?: string | number) => {
    const clean = name.trim()
    if (!clean) return
    if (!familyWeights.has(clean)) familyWeights.set(clean, new Set([400, 500, 600, 700]))
    if (weight) {
      const w = typeof weight === 'string' ? parseInt(weight.replace(/'/g, ''), 10) : weight
      if (!isNaN(w) && w >= 100 && w <= 900) familyWeights.get(clean)!.add(w)
    }
  }
  const fm = parseYamlFrontmatter(markdown)
  const typo = fm?.typography
  if (typo && typeof typo === 'object' && !Array.isArray(typo)) {
    for (const def of Object.values(typo as Record<string, YamlValue>)) {
      if (def && typeof def === 'object' && !Array.isArray(def)) {
        const rec = def as Record<string, YamlValue>
        const fam = rec.fontFamily
        if (typeof fam === 'string') addFamily(fam, rec.fontWeight as string | undefined)
      }
    }
  }
  const envelope = envelopeFromDesignMd(markdown)
  const heading = envelope.tokens?.typography?.heading?.trim()
  const body = envelope.tokens?.typography?.body?.trim()
  if (heading) addFamily(heading)
  if (body) addFamily(body)
  return familyWeights
}

function collectFontFamiliesFromDesignMd(markdown: string): string[] {
  return [...collectFontFamiliesWithWeights(markdown).keys()]
}

/** Enlace Google Fonts derivado del frontmatter typography de design.md. */
export function buildDesignMdGoogleFontsLinkTag(markdown: string): string {
  const familyWeights = collectFontFamiliesWithWeights(markdown)
  if (!familyWeights.size) return ''
  const params = [...familyWeights.entries()]
    .map(([f, weights]) => {
      const sorted = [...weights].sort((a, b) => a - b)
      return `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@${sorted.join(';')}`
    })
    .join('&')
  return `<link id="${DESIGN_MD_THEME_LINK_ID}" rel="stylesheet" href="https://fonts.googleapis.com/css2?${params}&display=swap">`
}

/** Bloque `<style>` con :root y reglas base alineadas a spec/design.md. */
export function buildDesignMdThemeStyleBlock(markdown: string): string {
  const md = markdown.trim()
  if (!md) return ''
  const cssRoot = designMdCssRootVariableHints(md)
  const envelope = envelopeFromDesignMd(md)
  const heading = envelope.tokens?.typography?.heading?.trim() || 'Georgia, serif'
  const body = envelope.tokens?.typography?.body?.trim() || 'system-ui, sans-serif'
  const background =
    envelope.tokens?.colors?.background?.trim() ||
    envelope.tokens?.colors?.surface?.trim() ||
    '#fafafa'
  const text =
    envelope.tokens?.colors?.text?.trim() ||
    envelope.tokens?.colors?.['on-surface']?.trim() ||
    '#1a1a1a'

  const primary = envelope.tokens?.colors?.primary?.trim() || '#333333'
  const primaryContainer =
    envelope.tokens?.colors?.secondary?.trim() ||
    'var(--color-primary-container, #555555)'
  const tertiary =
    envelope.tokens?.colors?.tertiary?.trim() || 'var(--color-tertiary-container, #777777)'

  const rules: string[] = []
  if (cssRoot) rules.push(cssRoot)
  rules.push(
    'html { -webkit-font-smoothing: antialiased; }',
    `body { font-family: "${body}", system-ui, sans-serif; font-size: 16px; line-height: 1.5; margin: 0; background: var(--color-background, ${background}); color: var(--color-on-surface, ${text}); }`,
    `h1, h2, h3, h4, .headline { font-family: "${heading}", Georgia, serif; font-weight: 600; color: var(--color-on-surface, ${text}); }`,
    'p, li, span, label { color: var(--color-on-surface-variant, var(--color-on-surface)); }',
    'header, nav { background: var(--color-surface-container, var(--color-surface-container-low, #f5f5f5)); }',
    `a { color: var(--color-primary, ${primary}); }`,
    'button, .btn, [role="button"] { border-radius: var(--radius-default, 0.5rem); font-family: inherit; cursor: pointer; }',
    `.btn-primary, button.primary, [data-sk-role="primary"] { background: var(--color-primary-container, ${primaryContainer}); color: var(--color-on-primary, #fff); border: none; padding: 0.75rem 1.5rem; }`,
    `.btn-secondary, button.secondary { background: var(--color-secondary-container, transparent); color: var(--color-on-surface); border: 1px solid var(--color-outline-variant, #c3c8c1); padding: 0.75rem 1.5rem; }`,
    `section { padding: var(--spacing-section-gap-md, 48px) var(--spacing-container-margin, 24px); }`,
    `.card, article { background: var(--color-surface-container-low, #f6f3ee); border-radius: var(--radius-default, 0.5rem); border: 1px solid var(--color-outline-variant, #e5e2dd); }`,
    `footer { background: var(--color-surface-container, ${background}); color: var(--color-on-surface-variant, ${text}); padding: 2rem var(--spacing-container-margin, 24px); }`,
    `.cta, .banner { background: var(--color-tertiary-container, ${tertiary}); color: var(--color-on-tertiary, #fff); }`,
  )
  return `<style id="${DESIGN_MD_THEME_STYLE_ID}">\n${rules.join('\n')}\n</style>`
}

/** CSS plano para persistir en design/system/theme.css. */
export function designMdThemeCssContent(markdown: string): string {
  const block = buildDesignMdThemeStyleBlock(markdown)
  if (!block) return ''
  const inner = block.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1]?.trim()
  return inner ?? ''
}

export function designMdThemeCssFile(markdown: string): { path: string; content: string } | null {
  const content = designMdThemeCssContent(markdown)
  if (!content) return null
  return { path: DESIGN_THEME_CSS_PATH, content }
}

/**
 * Inyecta fuentes y variables CSS de spec/design.md en el `<head>` del mockup.
 * Garantiza que el lienzo y el preview reflejen el design system aunque el modelo omita estilos.
 */
export function injectDesignMdThemeIntoHtml(
  html: string,
  designMd?: string | null,
  opts?: { themeCssHref?: string },
): string {
  const md = designMd?.trim()
  if (!md || !html.trim()) return html

  const linkTag = buildDesignMdGoogleFontsLinkTag(md)
  const themeLink = opts?.themeCssHref
    ? `<link rel="stylesheet" href="${opts.themeCssHref}">`
    : ''
  const styleBlock = buildDesignMdThemeStyleBlock(md)
  if (!linkTag && !styleBlock && !themeLink) return html

  let out = html
  out = out.replace(
    new RegExp(`<link[^>]*id=["']${DESIGN_MD_THEME_LINK_ID}["'][^>]*>`, 'gi'),
    '',
  )
  out = out.replace(
    new RegExp(
      `<style[^>]*id=["']${DESIGN_MD_THEME_STYLE_ID}["'][^>]*>[\\s\\S]*?</style>`,
      'gi',
    ),
    '',
  )

  const injection = `${linkTag}${themeLink}${styleBlock}`
  if (/<\/head>/i.test(out)) {
    return out.replace(/<\/head>/i, `${injection}</head>`)
  }
  if (/<body[\s>]/i.test(out)) {
    return out.replace(/<body/i, `<head>${injection}</head><body`)
  }
  if (/<html[\s>]/i.test(out)) {
    return out.replace(/<html([^>]*)>/i, `<html$1><head>${injection}</head>`)
  }
  return `${injection}${out}`
}

export function tokensJsonFromDesignMd(markdown: string): string {
  return envelopeToTokensJson(envelopeFromDesignMd(markdown))
}

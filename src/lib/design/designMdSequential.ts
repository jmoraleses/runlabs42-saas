import type { DesignBrief } from '@/lib/design/designBrief'
import type { VisualBriefInference } from '@/lib/design/visualBriefInference'
import {
  snapVisualColorsToDesignMd,
  visualReferenceColorRolesBlock,
} from '@/lib/design/visualColorRoles'
import { composeOrchestrationUserPrompt } from '@/lib/design/designBrief'
import { briefPaletteGuidanceBlock } from '@/lib/design/briefDesignDerivation'
import { m3PaletteFromBrief } from '@/lib/design/stitchDesignMdPalette'
import {
  REQUIRED_DESIGN_MD_SECTIONS,
  buildDesignMdFromBrief,
  buildStitchStyleDesignMd,
  defaultEnvelopeFromBrief,
  designMdExcerpt,
  designMdIsRichEnough,
  designMdSystemInstruction,
  parseYamlFrontmatter,
  type ResolvedDesignMd,
  resolveDesignMdFromModel,
} from '@/lib/design/designMd'

export type DesignMdStepId =
  | 'name'
  | 'colors-surfaces'
  | 'colors-roles'
  | 'typography'
  | 'shape-spacing'
  | 'section-brand'
  | 'section-colors'
  | 'section-typography'
  | 'section-layout'
  | 'section-elevation'
  | 'section-shapes'
  | 'section-photography'
  | 'section-components'

export type DesignMdPartialState = {
  name?: string
  colorsSurfaces?: string
  colorsRoles?: string
  typography?: string
  shapeSpacing?: string
  sections: Partial<Record<(typeof REQUIRED_DESIGN_MD_SECTIONS)[number], string>>
}

type DesignMdBuildStep = {
  id: DesignMdStepId
  phase: string
  task: string
}

const SECTION_STEP_IDS: Record<
  (typeof REQUIRED_DESIGN_MD_SECTIONS)[number],
  DesignMdStepId
> = {
  '## Brand & Style': 'section-brand',
  '## Colors': 'section-colors',
  '## Typography': 'section-typography',
  '## Layout & Spacing': 'section-layout',
  '## Elevation & Depth': 'section-elevation',
  '## Shapes': 'section-shapes',
  '## Photography & Imagery': 'section-photography',
  '## Components': 'section-components',
}

export const DESIGN_MD_BUILD_STEPS: DesignMdBuildStep[] = [
  {
    id: 'name',
    phase: 'design-md-step:name',
    task:
      'Genera SOLO la línea YAML `name:` (nombre del estilo, 2–5 palabras, evocador y específico al brief). Sin `---`, sin otros campos.',
  },
  {
    id: 'colors-surfaces',
    phase: 'design-md-step:colors-surfaces',
    task: `Genera SOLO las entradas YAML bajo \`colors:\` de superficies Material 3 (indentación 2 espacios bajo colors:):
surface, surface-dim, surface-bright, surface-container-lowest, surface-container-low, surface-container, surface-container-high, surface-container-highest,
on-surface, on-surface-variant, inverse-surface, inverse-on-surface, outline, outline-variant, surface-tint, background, on-background, surface-variant.
Hex entre comillas simples. Coherente con el brief y el \`name\` ya definido. Sin primary/secondary/tertiary aún.`,
  },
  {
    id: 'colors-roles',
    phase: 'design-md-step:colors-roles',
    task: `Genera SOLO las entradas YAML de roles semánticos (misma indentación bajo \`colors:\`):
primary, on-primary, primary-container, on-primary-container, inverse-primary,
secondary, on-secondary, secondary-container, on-secondary-container,
tertiary, on-tertiary, tertiary-container, on-tertiary-container,
error, on-error, error-container, on-error-container,
primary-fixed, primary-fixed-dim, on-primary-fixed, on-primary-fixed-variant,
secondary-fixed, secondary-fixed-dim, on-secondary-fixed, on-secondary-fixed-variant,
tertiary-fixed, tertiary-fixed-dim, on-tertiary-fixed, on-tertiary-fixed-variant.
Coherente con las superficies ya definidas.`,
  },
  {
    id: 'typography',
    phase: 'design-md-step:typography',
    task: `Genera SOLO el bloque YAML \`typography:\` completo con Google Fonts reales:
display-lg, headline-lg, headline-lg-mobile, headline-md, body-lg, body-md, label-md, label-sm
con fontFamily, fontSize, fontWeight, lineHeight (letterSpacing en labels). Sin \`colors:\` ni \`rounded:\`.
IMPORTANTE: (1) Usa nombres concretos de Google Fonts ("Playfair Display", "DM Sans", "Space Grotesk") — jamás "Serif" o "Sans-serif". (2) Una misma página puede tener 2 o 3 familias distintas: display-lg puede tener fontFamily diferente a headline-lg, y body-md puede diferir de ambos. Asigna la familia correcta a cada escala según el rol.`,
  },
  {
    id: 'shape-spacing',
    phase: 'design-md-step:shape-spacing',
    task:
      'Genera SOLO los bloques YAML `rounded:` (sm, DEFAULT, md, lg, xl, full) y `spacing:` (unit, container-margin, gutter, section-gap-lg, section-gap-md).',
  },
  ...REQUIRED_DESIGN_MD_SECTIONS.map((heading) => {
    const id = SECTION_STEP_IDS[heading]
    return {
      id,
      phase: `design-md-step:${id}`,
      task: `Genera SOLO la sección markdown "${heading}" con 2–4 párrafos o listas concretas del producto (sin repetir otras secciones). Empieza con la línea "${heading}".`,
    }
  }),
]

const DESIGN_MD_STEP_IMAGE_HINTS: Partial<Record<DesignMdStepId, string>> = {
  name: 'Deriva `name:` del estilo visible en la captura (marca, tono, 2–5 palabras evocadoras).',
  'colors-surfaces': `Extrae los colores de superficies DIRECTAMENTE de la imagen adjunta.
Usa eyedropper mental en cada zona: fondo principal (background/surface), tarjetas/cards (surface-container), bordes (outline-variant), zonas elevadas (surface-container-high), áreas recesadas (surface-dim).
Los 9 roles surface-* (surface, surface-dim, surface-bright, surface-container-lowest a -highest) DEBEN formar una rampa tonal con variación real — nunca todos iguales. Observa diferencias sutiles entre secciones alternas, footers, headers y cards en la captura.`,
  'colors-roles': `Extrae los colores de roles semánticos DIRECTAMENTE de la imagen adjunta.
- primary = hex del botón CTA principal observado en la captura.
- secondary = hex del fondo de la etiqueta "TOP VENTAS" (rosa/dusty pink en la captura) — NO gris neutro.
- tertiary = hex del fondo de la etiqueta "NUEVO" (naranja/terracota) — NO confundir con secondary.
Incluye on-primary, on-secondary, on-tertiary y containers coherentes. Contraste WCAG AA.`,
  typography: `ANALIZA TODAS LAS FUENTES EN LA IMAGEN — puede haber 2 o 3 familias distintas.

PASO 1 — Clasifica los títulos principales:
  A) Serif alto contraste (trazos finos/gruesos alternados, remates delicados) → Cormorant Garamond, Libre Baskerville, EB Garamond, Crimson Pro
  B) Serif bajo contraste (trazos uniformes, más geométrica) → Lora, Source Serif 4, Merriweather
  C) Serif display elegante (decorativa, alto peso visual) → Playfair Display, Bodoni Moda, Abril Fatface
  D) Sans geométrica (formas circulares, proporciones regulares) → DM Sans, Plus Jakarta Sans, Outfit, Nunito
  E) Sans humanista (trazos cálidos, ligeramente orgánicos) → Source Sans 3, Noto Sans, Cabin
  F) Sans grotesca (neutral, industrial) → Space Grotesk, Syne, Work Sans, Albert Sans
  G) Slab serif (remates rectangulares gruesos) → Roboto Slab, Zilla Slab, Bitter
  H) Rounded (terminaciones circulares) → Quicksand, Varela Round, Comfortaa

PASO 2 — Clasifica el body/UI (nav, botones, párrafos): ¿misma familia que heading o diferente?
PASO 3 — Elige de la categoría correcta la Google Font cuyas proporciones, peso y contraste se asemejen más.

Escribe un fontFamily distinto por escala si las formas son distintas (display-lg puede diferir de headline-lg).`,
  'shape-spacing':
    'Observa border-radius de botones, cards, imágenes producto; gutters y section-gap visibles en la captura.',
  'section-brand':
    'Describe tono y concepto de marca tal como se perciben en la UI capturada, no un estilo genérico inventado.',
  'section-colors':
    'Describe el uso de color que ves en la imagen: referencia los hex del YAML ya definido y dónde aparece cada uno en la UI (fondo, cards, CTAs, etiquetas, texto). La narrativa debe reflejar los colores reales de la captura.',
  'section-typography':
    'Documenta la jerarquía tipográfica observada: (1) nombre y clasificación de la fuente heading (serif humanista, sans geométrico, display grotesca…), (2) nombre y clasificación del body/UI, (3) escala visible (tamaño display muy grande vs headline moderado), (4) pesos usados (bold en CTAs, regular en body, medium en labels), (5) si reconoces la fuente por sus formas (ej. "trazos de Quicksand: remates circulares", "proporciones de Playfair: contraste alto"), nómbrala. Esta sección debe permitir replicar la tipografía sin ver la imagen.',
  'section-layout':
    'CRÍTICO: describe grid y zonas visibles en orden top→bottom (nav sticky, hero split, bento beneficios, grid productos, testimonios/newsletter, footer). Lista section.type que el layout JSON debe usar. Esta sección guía layout y HTML — prohibido hero→3 features plano si la captura es bento.',
  'section-elevation':
    'Documenta sombras y elevación de cards, summary box y controles como en la captura.',
  'section-shapes':
    'Pills, radius en thumbs, chips y contenedores observados en la referencia.',
  'section-photography':
    'Estilo fotográfico de productos/hero en la captura (luz, fondo, encuadre).',
  'section-components':
    'Lista componentes UI visibles (header nav, line-item, quantity stepper, remove link, summary rows, primary CTA, trust badges, upsell card).',
}

/** Instrucción corta por paso (respuestas pequeñas, sin recorte). */
export function designMdStepSystemInstruction(
  stepId: DesignMdStepId,
  hasImages = false,
): string {
  const imageBlock =
    hasImages && DESIGN_MD_STEP_IMAGE_HINTS[stepId]
      ? `\nImagen de referencia adjunta — ${DESIGN_MD_STEP_IMAGE_HINTS[stepId]}`
      : hasImages
        ? '\nImagen de referencia adjunta — alinea este paso con colores, tipografía y layout visibles en la captura.'
        : ''

  const colorPriority = hasImages && (stepId === 'colors-surfaces' || stepId === 'colors-roles')
    ? `\nFIDELIDAD CROMÁTICA: la imagen adjunta es la fuente de verdad para los colores. Extrae los hex dominantes que ves en la captura (fondo, cards, CTAs, badges, texto). El brief describe la intención, pero los hex deben corresponder a lo visible en la imagen. Asegura que los 9 roles surface-* formen una rampa tonal con variación real (nunca todos #FFFFFF ni todos iguales).`
    : ''

  const typographyPriority = hasImages && stepId === 'typography'
    ? `\nPRIORIDAD ABSOLUTA: la fuente que elijas DEBE coincidir con las formas tipográficas de la imagen — su clasificación (serif/sans/display), contraste de trazo y proporciones. El brief puede mencionar fuentes pero la imagen es la fuente de verdad visual.
ANTI-DEFAULT: NO uses Playfair Display, Montserrat, Inter ni Roboto salvo que los trazos de la imagen los muestren claramente. Estas fuentes son defaults del sistema — el modelo DEBE analizar las formas reales (terminaciones, ancho de trazo, altura de x, proporciones) e identificar la familia correcta. Si la referencia muestra una serif de alto contraste con terminaciones finas → Cormorant Garamond, Libre Baskerville. Si tiene trazos uniformes y geométricos → DM Sans, Outfit. Si es condensada y bold → Oswald, Barlow Condensed. Mira antes de elegir.`
    : ''

  return `Eres diseñador de sistemas web (Google Stitch). Colaboras en spec/design.md **por pasos** (PASO design.md: ${stepId}).
Responde ÚNICAMENTE el fragmento del paso actual. Sin fences, sin repetir pasos anteriores, sin JSON/HTML/layout.
Mantén coherencia absoluta con el documento parcial del usuario y el brief.${imageBlock}${colorPriority}${typographyPriority}`
}

export function assembleDesignMd(state: DesignMdPartialState): string {
  const lines: string[] = ['---']

  const name = state.name?.trim() || 'Design system'
  lines.push(`name: ${yamlScalar(name)}`)

  if (state.colorsSurfaces || state.colorsRoles) {
    lines.push('colors:')
    if (state.colorsSurfaces) lines.push(indentYamlFragment(state.colorsSurfaces, 2))
    if (state.colorsRoles) lines.push(indentYamlFragment(state.colorsRoles, 2))
  }

  if (state.typography) {
    lines.push('typography:')
    lines.push(indentYamlFragment(state.typography, 2))
  }

  if (state.shapeSpacing) {
    lines.push(...splitTopLevelYamlBlocks(state.shapeSpacing))
  }

  lines.push('---', '')

  for (const heading of REQUIRED_DESIGN_MD_SECTIONS) {
    const section = state.sections[heading]?.trim()
    if (section) {
      lines.push(section)
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd()
}

function yamlScalar(value: string): string {
  if (/[:#\n'"]/.test(value)) return `'${value.replace(/'/g, "''")}'`
  return value
}

function indentYamlFragment(fragment: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return fragment
    .split('\n')
    .map((line) => {
      const t = line.trimEnd()
      if (!t.trim()) return ''
      if (t.startsWith(pad)) return t
      if (t.startsWith('  ')) return `${pad}${t.trimStart()}`
      return `${pad}${t}`
    })
    .filter((line, i, arr) => line !== '' || i < arr.length - 1)
    .join('\n')
}

function splitTopLevelYamlBlocks(fragment: string): string[] {
  const blocks: string[] = []
  let current: string[] = []
  let currentKey: string | null = null

  for (const line of fragment.split('\n')) {
    const top = line.match(/^([a-z][a-z0-9-]*):/i)
    if (top && !line.startsWith('  ')) {
      if (currentKey && current.length) {
        blocks.push(`${currentKey}:`)
        blocks.push(...current.map((l) => `  ${l.trimStart()}`))
      }
      currentKey = top[1]!
      current = []
      continue
    }
    if (currentKey) current.push(line)
  }
  if (currentKey && current.length) {
    blocks.push(`${currentKey}:`)
    blocks.push(...current.map((l) => `  ${l.trimStart()}`))
  }
  return blocks
}

export function parseDesignMdStepOutput(
  text: string,
  stepId: DesignMdStepId,
): string | null {
  const trimmed = stripModelNoise(text)
  if (!trimmed) return null

  if (stepId === 'name') {
    const m = trimmed.match(/^name:\s*(.+)$/im)
    if (m?.[1]) return `name: ${m[1].trim()}`
    if (!trimmed.includes('\n') && trimmed.length < 80) {
      return `name: ${yamlScalar(trimmed.replace(/^name:\s*/i, '').trim())}`
    }
    return null
  }

  if (stepId.startsWith('section-')) {
    const heading = REQUIRED_DESIGN_MD_SECTIONS.find(
      (h) => SECTION_STEP_IDS[h] === stepId,
    )
    if (!heading) return null
    const re = new RegExp(
      `(##\\s*${heading.replace('## ', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*)`,
      'i',
    )
    const m = trimmed.match(re)
    if (m?.[1]) return normalizeSectionBlock(m[1], heading)
    if (trimmed.startsWith('##')) return normalizeSectionBlock(trimmed, heading)
    return `${heading}\n\n${trimmed}`
  }

  return stripYamlWrappers(trimmed)
}

function stripModelNoise(text: string): string {
  let t = text.trim()
  const fence = t.match(/```(?:yaml|markdown)?\s*\n?([\s\S]*?)```/i)
  if (fence?.[1]) t = fence[1].trim()
  t = t.replace(/^```(?:yaml|markdown)?\s*/i, '').replace(/```\s*$/i, '').trim()
  return t
}

function stripYamlWrappers(text: string): string {
  let t = text.trim()
  if (t.startsWith('colors:')) t = t.slice('colors:'.length).trim()
  if (t.startsWith('typography:')) t = t.slice('typography:'.length).trim()
  return t
}

function normalizeSectionBlock(block: string, heading: string): string {
  const lines = block.trim().split('\n')
  if (!lines[0]?.trim().toLowerCase().startsWith('##')) {
    return `${heading}\n\n${block.trim()}`
  }
  lines[0] = heading
  return lines.join('\n').trim()
}

function applyStepToState(
  state: DesignMdPartialState,
  stepId: DesignMdStepId,
  fragment: string,
): void {
  if (stepId === 'name') {
    const m = fragment.match(/^name:\s*(.+)$/i)
    state.name = m?.[1]?.trim() ?? fragment.replace(/^name:\s*/i, '').trim()
    return
  }
  if (stepId === 'colors-surfaces') state.colorsSurfaces = fragment
  else if (stepId === 'colors-roles') state.colorsRoles = fragment
  else if (stepId === 'typography') state.typography = fragment
  else if (stepId === 'shape-spacing') state.shapeSpacing = fragment
  else {
    const heading = REQUIRED_DESIGN_MD_SECTIONS.find(
      (h) => SECTION_STEP_IDS[h] === stepId,
    )
    if (heading) state.sections[heading] = fragment
  }
}

function fallbackFragmentForStep(
  stepId: DesignMdStepId,
  brief: DesignBrief,
): string {
  const template = buildStitchStyleDesignMd(defaultEnvelopeFromBrief(brief), brief)
  const fm = parseYamlFrontmatter(template)
  if (!fm) return ''

  if (stepId === 'name') {
    return `name: ${typeof fm.name === 'string' ? fm.name : 'Design system'}`
  }

  const colors = fm.colors
  if (typeof colors === 'object' && colors && !Array.isArray(colors)) {
    const colorEntries = Object.entries(colors as Record<string, unknown>)
    const surfaceKeys = colorEntries.filter(([k]) =>
      /^(surface|on-surface|inverse-surface|inverse-on-surface|outline|background|on-background|surface-variant|surface-tint)/.test(
        k,
      ),
    )
    const roleKeys = colorEntries.filter(([k]) => !surfaceKeys.some(([sk]) => sk === k))

    const toYamlLines = (entries: Array<[string, unknown]>) =>
      entries
        .map(([k, v]) => `  ${k}: '${String(v).replace(/^'|'$/g, '')}'`)
        .join('\n')

    if (stepId === 'colors-surfaces') {
      return surfaceKeys.map(([k, v]) => `  ${k}: '${v}'`).join('\n')
    }
    if (stepId === 'colors-roles') {
      return roleKeys.map(([k, v]) => `  ${k}: '${v}'`).join('\n')
    }
  }

  if (stepId === 'typography' && fm.typography) {
    return yamlObjectToFragment(fm.typography, 0)
  }
  if (stepId === 'shape-spacing') {
    const parts: string[] = []
    if (fm.rounded) parts.push(`rounded:\n${yamlObjectToFragment(fm.rounded, 2)}`)
    if (fm.spacing) parts.push(`spacing:\n${yamlObjectToFragment(fm.spacing, 2)}`)
    return parts.join('\n')
  }

  const heading = REQUIRED_DESIGN_MD_SECTIONS.find(
    (h) => SECTION_STEP_IDS[h] === stepId,
  )
  if (heading) {
    const body = template.includes('\n---\n')
      ? template.slice(template.indexOf('\n---\n') + 5)
      : template
    const re = new RegExp(
      `(${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?)(?=\\n## |$)`,
    )
    const m = body.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

function yamlObjectToFragment(value: unknown, baseIndent: number): string {
  const pad = ' '.repeat(baseIndent)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  const lines: string[] = []
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      lines.push(`${pad}${k}:`)
      lines.push(yamlObjectToFragment(v, baseIndent + 2))
    } else {
      lines.push(`${pad}${k}: ${String(v)}`)
    }
  }
  return lines.join('\n')
}

function buildStepUserPrompt(
  brief: DesignBrief,
  baseUserPrompt: string,
  state: DesignMdPartialState,
  step: DesignMdBuildStep,
  hasImages = false,
  visualProfile?: VisualBriefInference | null,
): string {
  const partial = assembleDesignMd(state)
  const partialBlock = partial.length > 20
    ? designMdExcerpt(partial)
    : '(aún vacío — primer paso)'

  // When the user provided a reference image, DON'T inject the brief-derived palette —
  // it would override the image's actual colors. Let the model extract from the image.
  const paletteBlock = hasImages
    ? ''
    : briefPaletteGuidanceBlock(brief, m3PaletteFromBrief(brief))

  const colorRoleSteps = new Set<DesignMdStepId>([
    'colors-surfaces',
    'colors-roles',
    'section-colors',
  ])
  const colorRolesBlock =
    hasImages &&
    visualProfile?.colorRoles &&
    colorRoleSteps.has(step.id)
      ? visualReferenceColorRolesBlock(visualProfile.colorRoles)
      : ''

  return composeOrchestrationUserPrompt(brief, [
    baseUserPrompt,
    paletteBlock,
    colorRolesBlock,
    '## spec/design.md (construcción en curso — contexto obligatorio)',
    partialBlock,
    `## design-md-step-id: ${step.id}`,
    `## Paso actual\n${step.task}`,
  ].filter(Boolean))
}

function mergeTemplateGaps(
  designMd: string,
  brief: DesignBrief,
  skipBriefTemplate = false,
): string {
  if (designMdIsRichEnough(designMd)) return designMd
  if (skipBriefTemplate) return designMd
  const template = buildStitchStyleDesignMd(defaultEnvelopeFromBrief(brief), brief)
  const state = partialStateFromDesignMd(designMd)
  const templateState = partialStateFromDesignMd(template)

  if (!state.name?.trim() && templateState.name) state.name = templateState.name
  if (!state.colorsSurfaces && templateState.colorsSurfaces) {
    state.colorsSurfaces = templateState.colorsSurfaces
  }
  if (!state.colorsRoles && templateState.colorsRoles) {
    state.colorsRoles = templateState.colorsRoles
  }
  if (!state.typography && templateState.typography) {
    state.typography = templateState.typography
  }
  if (!state.shapeSpacing && templateState.shapeSpacing) {
    state.shapeSpacing = templateState.shapeSpacing
  }

  for (const heading of REQUIRED_DESIGN_MD_SECTIONS) {
    if (!state.sections[heading]?.trim() && templateState.sections[heading]) {
      state.sections[heading] = templateState.sections[heading]
    }
  }

  const merged = assembleDesignMd(state)
  return designMdIsRichEnough(merged) ? merged : template
}

export function partialStateFromDesignMd(markdown: string): DesignMdPartialState {
  const state: DesignMdPartialState = { sections: {} }
  const fm = parseYamlFrontmatter(markdown)
  if (fm && typeof fm.name === 'string') state.name = fm.name

  const fmBody = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
  if (fmBody) {
    const colorsBlock = fmBody.match(/^colors:\r?\n([\s\S]*?)(?=^(?:typography|rounded|spacing):)/m)?.[1]
    if (colorsBlock) {
      const lines = colorsBlock.split('\n')
      const surfaces: string[] = []
      const roles: string[] = []
      for (const line of lines) {
        const key = line.trim().match(/^([a-z0-9-]+):/i)?.[1]
        if (!key) continue
        if (
          /^(surface|on-surface|inverse|outline|background|surface-variant|surface-tint)/i.test(
            key,
          )
        ) {
          surfaces.push(line.trim())
        } else {
          roles.push(line.trim())
        }
      }
      if (surfaces.length) state.colorsSurfaces = surfaces.join('\n')
      if (roles.length) state.colorsRoles = roles.join('\n')
    }
    const typoBlock = fmBody.match(/^typography:\r?\n([\s\S]*?)(?=^(?:rounded|spacing):)/m)?.[1]
    if (typoBlock) state.typography = typoBlock.trimEnd()
    const shapeParts: string[] = []
    const roundedBlock = fmBody.match(/^rounded:\r?\n([\s\S]*?)(?=^spacing:)/m)?.[1]
    const spacingBlock = fmBody.match(/^spacing:\r?\n([\s\S]*?)$/m)?.[1]
    if (roundedBlock) shapeParts.push(`rounded:\n${roundedBlock.trimEnd()}`)
    if (spacingBlock) shapeParts.push(`spacing:\n${spacingBlock.trimEnd()}`)
    if (shapeParts.length) state.shapeSpacing = shapeParts.join('\n')
  }

  const narrative = markdown.includes('\n---\n')
    ? markdown.slice(markdown.indexOf('\n---\n') + 5)
    : markdown
  for (const heading of REQUIRED_DESIGN_MD_SECTIONS) {
    const re = new RegExp(
      `(${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?)(?=\\n## |$)`,
    )
    const m = narrative.match(re)
    if (m?.[1]) state.sections[heading] = m[1].trim()
  }

  return state
}

export type SequentialDesignMdCall = (
  prompt: string,
  opts: {
    systemInstruction: string
    modelId: string
    images?: unknown[]
    signal?: AbortSignal
  },
) => Promise<string>

export type RunSequentialDesignMdOpts = {
  brief: DesignBrief
  baseUserPrompt: string
  modelId: string
  images?: unknown[]
  visualProfile?: VisualBriefInference | null
  signal?: AbortSignal
  send?: (type: string, data: string) => void
  onStepComplete?: (partialMd: string) => Promise<void>
  callText: SequentialDesignMdCall
}

function snapDesignMdToVisualColorRoles(
  designMd: string,
  visualProfile?: VisualBriefInference | null,
): string {
  if (!visualProfile?.colorRoles && !visualProfile?.dominantColors?.length) return designMd
  return snapVisualColorsToDesignMd(designMd, visualProfile)
}

/** design.md en una llamada (por defecto con imagen de referencia). Opt-out: DESIGN_MD_SEQUENTIAL=1 */
export function preferMonolithicDesignMd(): boolean {
  return process.env.DESIGN_MD_SEQUENTIAL !== '1'
}

/** Genera spec/design.md en una sola llamada (paridad Stitch). */
export async function runMonolithicDesignMdBuild(
  opts: RunSequentialDesignMdOpts,
): Promise<ResolvedDesignMd> {
  const { brief, baseUserPrompt, modelId, images, signal, send, onStepComplete, callText } =
    opts

  send?.('phase', 'design-md')

  const hasImages = Boolean(images?.length)
  const prompt = `${baseUserPrompt}

## Entrega
Responde con **un solo** bloque \`\`\`markdown spec/design.md\` con frontmatter YAML completo y todas las secciones obligatorias.
Formato alineado con export Google Stitch (M3 colors, typography headline-xl/body-md, spacing margin-mobile/desktop).
${hasImages ? 'Los hex del YAML deben extraerse de la imagen adjunta (muestra de color por rol M3).' : ''}`

  const text = await callText(prompt, {
    systemInstruction: designMdSystemInstruction(hasImages),
    modelId,
    images,
    signal,
  })

  let resolved = resolveDesignMdFromModel(text, brief)
  if (resolved.source === 'brief-fallback' || !designMdIsRichEnough(resolved.designMd)) {
    if (!hasImages) {
      const fallbackMd = buildDesignMdFromBrief(brief)
      resolved = resolveDesignMdFromModel(fallbackMd, brief)
      console.warn('[designMdSequential] design.md monolítico: usando plantilla desde brief')
      send?.('phase', 'design-md:brief-fallback')
    } else {
      console.warn(
        '[designMdSequential] design.md con imagen adjunta no alcanzó calidad; no se aplica plantilla genérica',
      )
      send?.('phase', 'design-md:reference-incomplete')
    }
  }

  const snappedMd = snapDesignMdToVisualColorRoles(resolved.designMd, opts.visualProfile)
  const snapped =
    snappedMd !== resolved.designMd
      ? resolveDesignMdFromModel(snappedMd, brief, { skipBriefFallback: hasImages })
      : resolved
  await onStepComplete?.(snapped.designMd)
  return snapped
}

/** Construye spec/design.md en pasos secuenciales con contexto acumulado. */
export async function runSequentialDesignMdBuild(
  opts: RunSequentialDesignMdOpts,
): Promise<ResolvedDesignMd> {
  const { brief, baseUserPrompt, modelId, images, signal, send, onStepComplete, callText } =
    opts
  const state: DesignMdPartialState = { sections: {} }
  const hasImages = Boolean(images?.length)

  // Pasos que requieren análisis visual preciso → upgrade a flash si el modelo base es flash-lite
  const visualAnalysisSteps = new Set<DesignMdStepId>(['colors-surfaces', 'colors-roles', 'typography', 'section-typography'])
  const upgradeModelId = hasImages && modelId.includes('flash-lite')
    ? modelId.replace('flash-lite', 'flash')
    : null

  for (const step of DESIGN_MD_BUILD_STEPS) {
    send?.('phase', step.phase)

    const stepModelId = (upgradeModelId && visualAnalysisSteps.has(step.id))
      ? upgradeModelId
      : modelId
    const prompt = buildStepUserPrompt(
      brief,
      baseUserPrompt,
      state,
      step,
      hasImages,
      opts.visualProfile,
    )
    let text = await callText(prompt, {
      systemInstruction: designMdStepSystemInstruction(step.id, hasImages),
      modelId: stepModelId,
      images,
      signal,
    })

    let fragment = parseDesignMdStepOutput(text, step.id)
    if (!fragment?.trim()) {
      const retryPrompt = `${prompt}\n\n## Corrección\nResponde SOLO el fragmento del paso "${step.id}" sin markdown fences ni texto extra.`
      text = await callText(retryPrompt, {
        systemInstruction: designMdStepSystemInstruction(step.id, hasImages),
        modelId: stepModelId,
        images,
        signal,
      })
      fragment = parseDesignMdStepOutput(text, step.id)
    }

    if (!fragment?.trim() && !hasImages) {
      fragment = fallbackFragmentForStep(step.id, brief)
      if (fragment) {
        console.warn(
          `[designMdSequential] paso ${step.id}: usando plantilla; modelo:`,
          text.slice(0, 200),
        )
      }
    } else if (!fragment?.trim() && hasImages) {
      console.warn(
        `[designMdSequential] paso ${step.id}: sin fragmento con imagen adjunta; no se aplica plantilla del brief`,
        text.slice(0, 200),
      )
    }

    if (fragment?.trim()) {
      applyStepToState(state, step.id, fragment)
      await onStepComplete?.(assembleDesignMd(state))
    }
  }

  let designMd = mergeTemplateGaps(assembleDesignMd(state), brief, hasImages)
  let resolved = resolveDesignMdFromModel(designMd, brief, {
    skipBriefFallback: hasImages,
  })

  if (!hasImages && (resolved.source === 'brief-fallback' || !designMdIsRichEnough(designMd))) {
    designMd = mergeTemplateGaps(designMd, brief, false)
    resolved = resolveDesignMdFromModel(designMd, brief)
  }

  const snappedMd = snapDesignMdToVisualColorRoles(resolved.designMd, opts.visualProfile)
  if (snappedMd !== resolved.designMd) {
    return resolveDesignMdFromModel(snappedMd, brief, { skipBriefFallback: hasImages })
  }
  return resolved
}

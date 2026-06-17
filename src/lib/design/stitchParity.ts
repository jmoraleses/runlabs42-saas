import type { OrchestrationLocale } from '@/lib/design/designBrief'
import { designMdExcerpt, parseYamlFrontmatter } from '@/lib/design/designMd'

/** Tema de proyecto devuelto por Stitch MCP (list_projects / get_project). */
export type StitchDesignTheme = {
  font?: string
  headlineFont?: string
  bodyFont?: string
  labelFont?: string
  roundness?: string
  colorMode?: string
  customColor?: string
  namedColors?: Record<string, string>
}

export type StitchProjectLike = {
  title?: string
  designMd?: string
  designTheme?: StitchDesignTheme
}

export type StitchReferenceBundle = {
  projectId: string
  screenId?: string
  title?: string
  designMd: string
  referenceHtml?: string
  referencePrompt?: string
  screenshotPath?: string
}

/** Paridad Stitch activa por defecto; desactivar con DESIGN_STITCH_PARITY=0. */
export function isStitchParityEnabled(_modelId?: string): boolean {
  return process.env.DESIGN_STITCH_PARITY !== '0'
}

/** HTML generado con el stack de export Stitch (Tailwind CDN + config). */
export function isStitchStyleHtml(html: string): boolean {
  const h = html.trim()
  return /cdn\.tailwindcss\.com/i.test(h) || /tailwind\.config/i.test(h) || /id=["']tailwind-config["']/i.test(h)
}

/** Markup que asume utilidades Tailwind (bg-*, flex, grid, py-*, etc.). */
export function htmlUsesTailwindUtilityClasses(html: string): boolean {
  return /\bclass=["'][^"']*\b(?:bg-|text-|flex|grid|gap-|py-|px-|rounded|font-|max-w-|md:)/i.test(
    html,
  )
}

/**
 * El lienzo solo debe montar iframe cuando el HTML puede aplicar estilos
 * (Tailwind CDN/config o CSS vanilla completo), no fragmentos con clases sin motor.
 */
const TAILWIND_CDN_SCRIPT_RE =
  /<script\b[^>]*\bsrc=["']https:\/\/cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>/i
const TAILWIND_CONFIG_SCRIPT_RE =
  /<script\b[^>]*\bid=["']tailwind-config["'][^>]*>[\s\S]*?<\/script>/i

/**
 * Tailwind Play CDN: el script CDN primero, luego `tailwind.config` (objeto `tailwind` ya existe).
 * Si `tailwind-config` va antes del CDN → `tailwind is not defined` y el theme extend no aplica.
 * Si hay `<style>` entre CDN y config, el CDN compila sin los colores custom.
 */
export function normalizeStitchTailwindHeadOrder(html: string): string {
  if (!isStitchStyleHtml(html)) return html

  const cdnMatch = html.match(TAILWIND_CDN_SCRIPT_RE)
  const configMatch = html.match(TAILWIND_CONFIG_SCRIPT_RE)
  if (!cdnMatch?.[0] || !configMatch?.[0]) return html

  const cdnTag = cdnMatch[0]
  const configTag = configMatch[0]

  const configBeforeCdn = configMatch.index! < cdnMatch.index!
  const betweenCdnAndConfig =
    cdnMatch.index! < configMatch.index!
      ? html.slice(cdnMatch.index! + cdnTag.length, configMatch.index!)
      : ''
  const styleBetweenCdnAndConfig = /<style\b/i.test(betweenCdnAndConfig)
  if (!configBeforeCdn && !styleBetweenCdnAndConfig) return html

  let out = html.replace(TAILWIND_CDN_SCRIPT_RE, '').replace(TAILWIND_CONFIG_SCRIPT_RE, '')
  const bundle = `${cdnTag}\n    ${configTag}`
  if (/<head[^>]*>/i.test(out)) {
    return out.replace(/<head([^>]*)>/i, `<head$1>\n    ${bundle}`)
  }
  return html
}

export function isCanvasPreviewHtmlReady(html: string | null | undefined): boolean {
  const trimmed = html?.trim()
  if (!trimmed) return false
  if (isStitchStyleHtml(trimmed)) return true
  if (htmlUsesTailwindUtilityClasses(trimmed)) return false
  return /<style[^>]*>[\s\S]{80,}<\/style>/i.test(trimmed) || trimmed.length >= 400
}

/** HTML monolítico (como Stitch) en lugar de shell + secciones cuando hay streaming. */
export function preferMonolithicOrchestrationHtml(
  modelId?: string,
  opts?: { send?: unknown; persistPartial?: unknown },
): boolean {
  if (isStitchParityEnabled(modelId)) return true
  return process.env.DESIGN_HTML_MONOLITH_FIRST === '1'
}

/** Convierte designTheme de Stitch a spec/design.md (YAML M3). */
export function designMdFromStitchTheme(
  project: StitchProjectLike,
  typographyScale?: Record<string, { fontFamily?: string; fontSize?: string; fontWeight?: string; lineHeight?: string; letterSpacing?: string }>,
): string {
  const existing = project.designMd?.trim()
  if (existing && existing.includes('colors:')) return existing

  const t = project.designTheme
  const nc = t?.namedColors ?? {}
  const name = project.title?.trim() || 'Stitch design system'
  const heading = normalizeStitchFontName(t?.headlineFont ?? t?.font ?? 'Inter')
  const body = normalizeStitchFontName(t?.bodyFont ?? t?.font ?? heading)

  const defaultTypo = typographyScale ?? Object.fromEntries(
    Object.entries(STITCH_EXPORT_TYPOGRAPHY_DEFAULTS).map(([key, spec]) => [
      key,
      {
        ...spec,
        fontFamily: key.startsWith('body') || key.startsWith('label') ? body : heading,
      },
    ]),
  )

  const colorLines = Object.entries(nc).map(([k, v]) => `  ${k.replace(/_/g, '-')}: '${v}'`)
  const typoLines: string[] = []
  for (const [key, spec] of Object.entries(defaultTypo)) {
    typoLines.push(`  ${key}:`)
    if (spec.fontFamily) typoLines.push(`    fontFamily: ${spec.fontFamily}`)
    if (spec.fontSize) typoLines.push(`    fontSize: ${spec.fontSize}`)
    if (spec.fontWeight) typoLines.push(`    fontWeight: '${spec.fontWeight}'`)
    if (spec.lineHeight) typoLines.push(`    lineHeight: '${spec.lineHeight}'`)
    if (spec.letterSpacing) typoLines.push(`    letterSpacing: ${spec.letterSpacing}`)
  }

  return [
    '---',
    `name: ${name}`,
    'colors:',
    ...(colorLines.length ? colorLines : ["  primary: '#2563eb'", "  surface: '#ffffff'"]),
    'typography:',
    ...typoLines,
    'rounded:',
    ...Object.entries(STITCH_EXPORT_BORDER_RADIUS_DEFAULTS).map(
      ([k, v]) => `  ${k === 'DEFAULT' ? 'DEFAULT' : k}: ${v}`,
    ),
    'spacing:',
    ...Object.entries(STITCH_EXPORT_SPACING_DEFAULTS).map(([k, v]) => `  ${k}: ${v}`),
    '---',
    '',
    `# ${name}`,
    '',
    '## Brand & Style',
    `Tipografía principal: ${heading}. Cuerpo: ${body}. Modo: ${t?.colorMode ?? 'LIGHT'}. Redondez: ${t?.roundness ?? 'default'}.`,
    '',
    '## Layout & Spacing',
    'Contenedor max ~1280px; márgenes y gutters según tokens spacing del frontmatter.',
    '',
    '## Components',
    '- Botón primario: fondo primary-container o primary, texto on-primary.',
    '- Tarjetas: surface-container con soft-shadow suave.',
    '- Hover interactivo: ligera escala (bouncy) en CTAs.',
    '',
    '## Photography & Imagery',
    'Con captura de referencia: describe el estilo fotográfico visible (luz, fondo, encuadre) para assets posteriores.',
    'Sin referencia visual: placeholders con gradiente en paleta primary/surface; coherencia cálida.',
  ].join('\n')
}

export function normalizeStitchFontName(font?: string): string {
  const raw = String(font ?? 'Inter').trim()
  if (!raw || raw === 'FONT_UNSPECIFIED') return 'Inter'
  return raw
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Escala tipográfica por defecto alineada al export HTML de Google Stitch. */
export const STITCH_EXPORT_TYPOGRAPHY_DEFAULTS: Record<
  string,
  {
    fontFamily?: string
    fontSize?: string
    fontWeight?: string
    lineHeight?: string
    letterSpacing?: string
  }
> = {
  'headline-xl': {
    fontFamily: 'system-ui',
    fontSize: '48px',
    fontWeight: '700',
    lineHeight: '56px',
    letterSpacing: '-0.02em',
  },
  'headline-xl-mobile': {
    fontFamily: 'system-ui',
    fontSize: '32px',
    fontWeight: '700',
    lineHeight: '40px',
    letterSpacing: '-0.02em',
  },
  'headline-lg': {
    fontFamily: 'system-ui',
    fontSize: '32px',
    fontWeight: '700',
    lineHeight: '40px',
  },
  'headline-md': {
    fontFamily: 'system-ui',
    fontSize: '24px',
    fontWeight: '600',
    lineHeight: '32px',
  },
  'body-lg': {
    fontFamily: 'system-ui',
    fontSize: '18px',
    fontWeight: '500',
    lineHeight: '28px',
  },
  'body-md': {
    fontFamily: 'system-ui',
    fontSize: '16px',
    fontWeight: '500',
    lineHeight: '24px',
  },
  'label-md': {
    fontFamily: 'system-ui',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: '20px',
    letterSpacing: '0.01em',
  },
  'label-sm': {
    fontFamily: 'system-ui',
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: '16px',
  },
}

/** Spacing tokens del export Stitch (tailwind theme.extend.spacing). */
export const STITCH_EXPORT_SPACING_DEFAULTS: Record<string, string> = {
  'container-max': '1280px',
  'margin-mobile': '20px',
  base: '8px',
  'gutter-desktop': '24px',
  'gutter-mobile': '16px',
  'margin-desktop': '48px',
  'section-gap-lg': '80px',
  'section-gap-md': '48px',
}

/** borderRadius del export Stitch (ROUND_FOUR / ROUND_EIGHT típico). */
export const STITCH_EXPORT_BORDER_RADIUS_DEFAULTS: Record<string, string> = {
  DEFAULT: '0.25rem',
  lg: '0.5rem',
  xl: '0.75rem',
  full: '9999px',
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return Object.keys(out).length ? out : undefined
}

function asNestedTypographyRecord(
  value: unknown,
): Record<string, Record<string, string>> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, Record<string, string>> = {}
  for (const [k, v] of Object.entries(value)) {
    const inner = asStringRecord(v)
    if (inner) out[k] = inner
  }
  return Object.keys(out).length ? out : undefined
}

function isLiteralHexColor(value: string): boolean {
  const v = value.trim()
  return /^#[0-9a-fA-F]{3,8}$/.test(v) && !v.startsWith('var(')
}

/** true si design.md trae al menos un color hex en el frontmatter (export Stitch real). */
export function designMdHasStitchColorTokens(markdown: string | null | undefined): boolean {
  if (!markdown?.trim()) return false
  const fm = parseYamlFrontmatter(markdown)
  const yamlColors = asStringRecord(fm?.colors)
  if (!yamlColors) return false
  return Object.values(yamlColors).some(isLiteralHexColor)
}

function mergeTypographyScale(
  markdown: string,
): Record<string, Record<string, string>> {
  const fm = parseYamlFrontmatter(markdown)
  const fromYaml = asNestedTypographyRecord(fm?.typography) ?? {}
  const merged: Record<string, Record<string, string>> = {}

  // Derive heading/body fallback fonts from the YAML instead of using Quicksand defaults
  const yamlHeadingFont =
    fromYaml['display-lg']?.fontFamily ??
    fromYaml['headline-lg']?.fontFamily ??
    fromYaml['headline-xl']?.fontFamily ??
    fromYaml['headline-md']?.fontFamily
  const yamlBodyFont =
    fromYaml['body-md']?.fontFamily ??
    fromYaml['body-lg']?.fontFamily ??
    fromYaml['label-md']?.fontFamily

  const isHeadingScale = (key: string) =>
    key.startsWith('headline') || key.startsWith('display')
  const yamlFallbackFont = (key: string) =>
    isHeadingScale(key) ? yamlHeadingFont : yamlBodyFont

  const keys = new Set([
    ...Object.keys(STITCH_EXPORT_TYPOGRAPHY_DEFAULTS),
    ...Object.keys(fromYaml),
  ])
  for (const key of keys) {
    const base = STITCH_EXPORT_TYPOGRAPHY_DEFAULTS[key] ?? {}
    const yaml = fromYaml[key] ?? {}
    // Priority: YAML explicit > YAML inferred from same role > Stitch default
    const fontFamily = yaml.fontFamily ?? yamlFallbackFont(key) ?? base.fontFamily
    merged[key] = {
      ...(fontFamily ? { fontFamily } : {}),
      ...(yaml.fontSize ?? base.fontSize ? { fontSize: yaml.fontSize ?? base.fontSize! } : {}),
      ...(yaml.fontWeight ?? base.fontWeight
        ? { fontWeight: yaml.fontWeight ?? base.fontWeight! }
        : {}),
      ...(yaml.lineHeight ?? base.lineHeight
        ? { lineHeight: yaml.lineHeight ?? base.lineHeight! }
        : {}),
      ...(yaml.letterSpacing ?? base.letterSpacing
        ? { letterSpacing: yaml.letterSpacing ?? base.letterSpacing! }
        : {}),
    }
  }
  return merged
}

function typographyToTailwindFontSizeJs(spec: Record<string, string>): string {
  const size = spec.fontSize?.trim() || '16px'
  const opts: string[] = []
  if (spec.lineHeight?.trim()) opts.push(`"lineHeight": "${spec.lineHeight.trim()}"`)
  if (spec.letterSpacing?.trim()) opts.push(`"letterSpacing": "${spec.letterSpacing.trim()}"`)
  if (spec.fontWeight?.trim()) opts.push(`"fontWeight": "${spec.fontWeight.replace(/'/g, '')}"`)
  if (!opts.length) return `["${size}"]`
  return `["${size}", { ${opts.join(', ')} }]`
}

function formatTailwindKeyedBlock(entries: Record<string, string>, quoteKeys = true): string {
  const lines = Object.entries(entries).map(([k, v]) => {
    const key = quoteKeys ? `"${k}"` : k === 'DEFAULT' ? 'DEFAULT' : `"${k}"`
    return `                      ${key}: "${v.replace(/"/g, '\\"')}"`
  })
  return `{\n${lines.join(',\n')}\n              }`
}

/** theme.extend completo derivado de spec/design.md (export Stitch). */
export function buildTailwindThemeExtendFromDesignMd(markdown: string): {
  colors: Record<string, string>
  borderRadius: Record<string, string>
  spacing: Record<string, string>
  fontFamily: Record<string, string[]>
  fontSize: Record<string, string>
} {
  const fm = parseYamlFrontmatter(markdown)
  const colors: Record<string, string> = {}
  const yamlColors = asStringRecord(fm?.colors)
  if (yamlColors) {
    for (const [k, v] of Object.entries(yamlColors)) {
      if (isLiteralHexColor(v)) colors[k.replace(/_/g, '-')] = v
    }
  }

  const rounded = { ...STITCH_EXPORT_BORDER_RADIUS_DEFAULTS, ...asStringRecord(fm?.rounded) }
  const spacing = { ...STITCH_EXPORT_SPACING_DEFAULTS, ...asStringRecord(fm?.spacing) }

  const typoScale = mergeTypographyScale(markdown)
  const fontFamily: Record<string, string[]> = {}
  const fontSize: Record<string, string> = {}
  for (const [scale, spec] of Object.entries(typoScale)) {
    const fam = spec.fontFamily?.trim()
    if (fam) fontFamily[scale] = [fam.replace(/'/g, '')]
    fontSize[scale] = typographyToTailwindFontSizeJs(spec)
  }

  return { colors, borderRadius: rounded, spacing, fontFamily, fontSize }
}

function formatTailwindThemeExtendJs(extend: ReturnType<typeof buildTailwindThemeExtendFromDesignMd>): string {
  const colorBlock = formatTailwindKeyedBlock(extend.colors)
  const radiusBlock = formatTailwindKeyedBlock(extend.borderRadius)
  const spacingBlock = formatTailwindKeyedBlock(extend.spacing)
  const familyLines = Object.entries(extend.fontFamily).map(
    ([k, v]) => `                      "${k}": [${v.map((f) => `"${f}"`).join(', ')}]`,
  )
  const sizeLines = Object.entries(extend.fontSize).map(
    ([k, v]) => `                      "${k}": ${v}`,
  )
  return `{
              "colors": ${colorBlock},
              "borderRadius": ${radiusBlock},
              "spacing": ${spacingBlock},
              "fontFamily": {
${familyLines.join(',\n')}
              },
              "fontSize": {
${sizeLines.join(',\n')}
              }
            }`
}

/** Cuerpo de tailwind.config listo para <script id="tailwind-config">. */
export function buildStitchTailwindConfigScriptBody(designMd: string): string {
  const extend = buildTailwindThemeExtendFromDesignMd(designMd)
  return `tailwind.config = {
          darkMode: "class",
          theme: {
            extend: ${formatTailwindThemeExtendJs(extend)}
          }
        }`
}

/** Inyecta o reemplaza tailwind.config desde design.md y normaliza orden CDN → config. */
export function mergeStitchTailwindConfigFromDesignMd(
  html: string,
  designMd?: string | null,
): string {
  if (!isStitchStyleHtml(html)) return html
  if (!designMd?.trim() || !designMdHasStitchColorTokens(designMd)) {
    return normalizeStitchTailwindHeadOrder(html)
  }

  const scriptBody = buildStitchTailwindConfigScriptBody(designMd)
  const configTag = `<script id="tailwind-config">\n        ${scriptBody}\n      </script>`

  let out = html
  if (TAILWIND_CONFIG_SCRIPT_RE.test(out)) {
    out = out.replace(TAILWIND_CONFIG_SCRIPT_RE, configTag)
  } else {
    const cdn =
      '<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>'
    if (TAILWIND_CDN_SCRIPT_RE.test(out)) {
      out = out.replace(TAILWIND_CDN_SCRIPT_RE, `${cdn}\n    ${configTag}`)
    } else if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, `<head$1>\n    ${cdn}\n    ${configTag}`)
    }
  }

  return normalizeStitchTailwindHeadOrder(out)
}

/** Lista de secciones observadas en HTML de referencia Stitch (comentarios + h2). */
export function stitchSectionParityChecklistFromHtml(html: string): string[] {
  const items: string[] = []
  for (const m of html.matchAll(/<!--\s*([^>]+?)\s*-->/g)) {
    const label = m[1]?.trim()
    if (label && /section|nav|hero|footer|arrival|grid|choose|bento/i.test(label)) {
      items.push(label)
    }
  }
  for (const m of html.matchAll(/<h2[^>]*>([^<]{2,80})/gi)) {
    items.push(m[1]!.replace(/&amp;/g, '&').trim())
  }
  return [...new Set(items)].slice(0, 14)
}

/** Reglas de revisión HTML para equivalencia de secciones con referencia Stitch. */
/** Hints para la fase layout JSON cuando hay HTML de referencia Stitch. */
export function stitchLayoutParityHints(referenceHtml?: string): string {
  if (!referenceHtml?.trim()) return ''
  const checklist = stitchSectionParityChecklistFromHtml(referenceHtml)
  const lines = [
    '## Layout fiel a referencia Stitch (obligatorio)',
    'El JSON de layout debe reflejar la misma topología que la referencia HTML (no un landing SaaS genérico).',
    'Declara section.type descriptivos alineados con zonas visibles (site-header, hero-split, bento-benefits, product-grid, testimonial-row, site-footer, etc.).',
    'Si el brief pide una sola pantalla, usa una sola page (id home o el slug del brief).',
  ]
  if (checklist.length) {
    lines.push(
      'Secciones observadas en la referencia (cúbrelas en sections[] de la page principal):',
      ...checklist.map((s) => `- ${s}`),
    )
  }
  if (/bento|col-span-2|md:col-span/i.test(referenceHtml)) {
    lines.push(
      '- La referencia usa **bento** asimétrico: incluye section.type bento o benefits-bento con composition asymmetric; no sustituyas por features en 3 columnas planas.',
    )
  }
  if (/product|chick|pollito|grid-cols/i.test(referenceHtml)) {
    lines.push(
      '- Incluye grid de productos (section.type product-grid o gallery) si aparece en la referencia.',
    )
  }
  return lines.join('\n')
}

export function stitchSectionParityReviewRules(referenceHtml?: string): string {
  if (!referenceHtml?.trim()) return ''
  const checklist = stitchSectionParityChecklistFromHtml(referenceHtml)
  if (!checklist.length) return ''
  return `
Checklist de secciones Stitch (layout equivalente; copy en el idioma del brief):
${checklist.map((s) => `- ${s}`).join('\n')}
- Beneficios: si la referencia usa **grid bento** (md:col-span-2, tarjetas asimétricas), replícalo; no sustituyas por 3 columnas planas.
- Hero: clases responsive text-headline-xl-mobile md:text-headline-xl cuando existan en tailwind.config.
- Imágenes: mismas proporciones (aspect-[4/3], bordes redondeados); gradientes de paleta o assets locales — evita picsum aleatorio si hay referencia Stitch.`.trim()
}

/** Reglas de stack HTML alineadas con export de Google Stitch. */
export function stitchParityHtmlSystemRules(): string {
  return `
MODO PARIDAD STITCH (obligatorio):
1. En <head>, PRIMERO el CDN: <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
2. INMEDIATAMENTE DESPUÉS <script id="tailwind-config"> con tailwind.config = { darkMode: "class", theme: { extend: { colors, fontSize, fontFamily, spacing, borderRadius } } } } — hex LITERALES del YAML; fontSize/fontFamily/spacing/rounded completos como en el bloque de ejemplo del prompt.
3. Sin ningún <style> entre CDN y tailwind-config (el CDN debe ver el objeto tailwind ya definido).
4. Enlace Google Fonts para las familias del YAML typography de design.md.
5. Enlace Material Symbols Outlined si hay iconos.
6. Los <style> propios (.bouncy-hover, .soft-shadow) van DESPUÉS de CDN + config.
7. Tipografía: usa SOLO las clases del tailwind.config — text-headline-*, text-body-*, text-label-* para tamaño+line-height y font-headline-*, font-body-*, font-label-* para font-family. NUNCA inventes clases font-{nombre-familia} como font-cormorant o font-albert — esas NO existen en el config y no aplican ninguna fuente.
8. Clases utility Tailwind en el markup; evita :root extenso salvo resets mínimos.
9. data-sk-id en elementos editables y contenedores (sk-nav, sk-main, sk-sec-*, sk-footer).
10. Sin React/Vue; un HTML completo por pantalla; altura razonable (no scroll infinito vacío).
11. Si hay ## Referencia HTML Stitch, replica composición, densidad, bento y jerarquía — **no copies el copy en inglés**; usa el idioma del brief.
12. \`<html lang="es">\` o \`lang="en"\` según el bloque de idioma del prompt.
13. IMÁGENES — PROHIBIDO ABSOLUTO picsum.photos, unsplash.com, lorempixel o cualquier URL externa de foto. Cuando no hay assets generados, usa un único \`<div>\` contenedor con la clase de gradiente como placeholder visual: \`<div class="rounded-xl aspect-[4/3] bg-gradient-to-br from-primary-container/70 to-secondary-container/50 soft-shadow w-full"></div>\`. Cuando sí hay assets (assets/*.jpg declarados con [IMAGE:] o ya generados), usa \`<img src="assets/..." class="rounded-xl aspect-[4/3] object-cover w-full soft-shadow">\` SIN div gradiente hermano — uno u otro, nunca ambos apilados.
14. NAVEGACIÓN: enlaces internos con href reales — home \`href="/"\`, otras pantallas \`href="/pages/{pageId}"\` (ids del layout). NO uses href="#". Formularios: \`data-form-id\` único + campos con \`name\`; sin action ni JavaScript.
15. ANIMACIONES: conserva @keyframes, clases animate-*, data-aos y transitions del design.md; no las elimines en revisión.`.trim()
}

/** Ajustes de espaciado típicos del export Stitch (post html-review). */
export function stitchVisualPolishReviewRules(): string {
  return `
Pulido visual Stitch (si aplica):
- Verifica tailwind.config: darkMode "class", theme.extend con colors, fontSize, fontFamily, spacing y borderRadius (no solo colors).
- CTAs hero: \`px-8 py-4\`, \`text-headline-md\` o \`font-headline-md\`; no botones planos.
- Beneficios bento: \`md:col-span-2\`, \`p-10\`, \`rounded-3xl\` donde la referencia Stitch lo use; no grid 3×1 plano si la referencia es bento.
- Nav sticky: \`py-4\`, \`max-w-container-max mx-auto px-margin-desktop\`.
- Hero titular: \`text-headline-xl-mobile md:text-headline-xl\`.
- Sombras: \`.soft-shadow\` o \`shadow-[0_4px_20px_rgba(255,165,0,0.08)]\`; hover \`.bouncy-hover\` scale(0.98) como Stitch.
- IMÁGENES: reemplaza cualquier <img src="https://picsum.photos/..."> o URL externa por \`<div>\` con gradiente de paleta. Hero → \`<div class="rounded-xl aspect-[4/3] bg-gradient-to-br from-primary-container/70 to-secondary-container/50 soft-shadow w-full"></div>\`. Producto → \`<div class="rounded-lg aspect-square bg-gradient-to-br from-secondary-container to-surface-container-high w-full"></div>\`. NO actives \`data-src\` → \`src\` para URLs externas; elimínalos.`.trim()
}

/** Fragmento theme.extend.colors para el prompt HTML (hex literales del YAML). */
export function designMdTailwindColorsHint(markdown: string): string {
  const extend = buildTailwindThemeExtendFromDesignMd(markdown)
  if (!Object.keys(extend.colors).length) return ''
  const colorBlock = formatTailwindKeyedBlock(extend.colors, false)
    .replace(/                      /g, '          ')
  return `theme: { extend: { colors: ${colorBlock} } }`
}

/** Bloque tailwind.config completo para prompts HTML (paridad export Stitch). */
export function designMdTailwindConfigHint(markdown: string): string {
  const body = buildStitchTailwindConfigScriptBody(markdown)
  return body.replace(/\n          /g, '\n')
}

export type StitchHtmlGuidancePartId = 'shell' | 'footer' | 'full' | 'review' | string

/** Bloques de prompt HTML en modo Stitch (Tailwind, no :root vanilla). */
export function stitchDesignMdHtmlGuidanceBlocks(
  markdown: string,
  partId?: StitchHtmlGuidancePartId,
): string[] {
  const md = markdown.trim()
  if (!md) return []

  const configHint = designMdTailwindConfigHint(md)
  const blocks: string[] = [
    '## spec/design.md — FUENTE DE VERDAD (stack Google Stitch)',
    'Colores, tipografía, spacing y borderRadius del YAML → Tailwind CDN + tailwind.config completo (no solo colors).',
    designMdExcerpt(md),
    stitchParityHtmlSystemRules(),
  ]

  if (partId === 'shell') {
    blocks.push(
      '### Paso shell (Stitch)',
      '- <!DOCTYPE>, <html>, <head>: charset, viewport, Google Fonts del YAML, Material Symbols si hay iconos.',
      '- <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script> PRIMERO.',
      '- <script id="tailwind-config">' + (configHint || 'tailwind.config = { darkMode: "class", theme: { extend: { … } } }') + '</script> justo después (sin <style> entre ambos).',
      '- <body>, <header>/<nav> con clases Tailwind; abre <main data-sk-id="sk-main"> sin cerrar documento.',
    )
  } else if (partId === 'footer') {
    blocks.push(
      '### Paso footer (Stitch)',
      '- <footer data-sk-id="sk-footer"> con clases bg-surface-container, text-on-surface-variant, etc.',
      '- Cierra </main></body></html>; sin repetir cabecera.',
    )
  } else if (partId === 'full') {
    blocks.push(
      '### Documento monolítico (Stitch)',
      '- UN HTML completo: Tailwind CDN + tailwind-config (colors, fontSize, fontFamily, spacing, borderRadius), secciones en <main>, <footer>.',
      configHint ? `Ejemplo tailwind.config:\n\`\`\`js\n${configHint}\n\`\`\`` : '',
    )
  } else if (partId === 'review') {
    blocks.push(
      '### Revisión visual (Stitch)',
      '- Corrige paleta, tipografía (fontSize tokens), spacing y borderRadius vía tailwind.config + clases; no :root vanilla.',
      '- Conserva todos los data-sk-id.',
      stitchVisualPolishReviewRules(),
    )
  } else if (partId?.startsWith('section-')) {
    blocks.push(
      '### Sección (Stitch)',
      '- Fragmento con clases utility (bg-surface-container, text-primary, rounded-lg, etc.) alineadas al YAML.',
      '- data-sk-id únicos sk-sec-*; sin DOCTYPE ni header duplicado.',
    )
  }

  return blocks.filter((line) => line.trim().length > 0)
}

export function stitchReferencePromptBlocks(
  ref: StitchReferenceBundle,
  locale: OrchestrationLocale = 'es',
): string[] {
  const blocks: string[] = [
    '## Paridad Google Stitch',
    'Equivalencia visual con el proyecto Stitch (paleta, tipografía, Tailwind config, ritmo de secciones).',
    designMdExcerpt(ref.designMd),
  ]
  if (ref.referencePrompt?.trim()) {
    blocks.push(
      '## Prompt original del proyecto Stitch',
      'Usa este texto como brief primario (misma intención que en Stitch):',
      ref.referencePrompt.trim(),
    )
  }
  if (ref.screenshotPath?.trim()) {
    blocks.push(
      '## Captura gold Stitch (PNG adjunta al mensaje)',
      'La imagen adjunta es la captura exportada de Stitch. Replica su composición (nav, hero, bento, grids, footer), proporciones y densidad visual — no un landing genérico.',
      'IMPORTANTE: NO copies URLs de imágenes de la captura. Usa gradientes de la paleta o assets propios generados.',
    )
  }
  if (ref.referenceHtml?.trim()) {
    // Solo extraemos la lista de secciones para guiar el layout — NUNCA el HTML completo,
    // para evitar que el modelo copie URLs de imágenes externas (lh3.googleusercontent.com, etc.)
    const sectionRules = stitchSectionParityReviewRules(ref.referenceHtml)
    if (sectionRules) blocks.push(sectionRules)
    const layoutHints = stitchLayoutParityHints(ref.referenceHtml)
    if (layoutHints) blocks.push(layoutHints)
  }
  return blocks
}

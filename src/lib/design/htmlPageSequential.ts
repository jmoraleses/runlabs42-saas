import type { DesignBrief } from '@/lib/design/designBrief'
import { composeOrchestrationUserPrompt, resolveOrchestrationLocale } from '@/lib/design/designBrief'
import { designMdHtmlGuidanceBlocks } from '@/lib/design/designMd'
import {
  designMdTailwindConfigHint,
  isStitchParityEnabled,
} from '@/lib/design/stitchParity'
import { contentComponentSystemInstruction } from '@/lib/design/orchestrationPrompts'
import { DESIGN_BREAKPOINT_PRESETS, type DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import {
  hasRenderableDocumentRoot,
  prepareOrchestrationPageHtmlForPersist,
  repairTruncatedPageHtml,
} from '@/lib/design/orchestrationHtmlQuality'
import type { OrchestrationLayoutPage } from '@/lib/design/orchestrationParse'
import { isDesignPreviewPlaceholderHtml } from '@/lib/design/isDesignPreviewPlaceholderHtml'
import { pageHtmlPath } from '@/lib/design/pages'
import type { VisualBriefInference } from '@/lib/design/visualBriefInference'
import { topologyDefaultSectionTypes } from '@/lib/design/visualBriefInference'

export type LayoutSectionHint = {
  type?: string
  style?: string
  composition?: string
  description?: string
}

export type PageHtmlPartId = 'shell' | `section-${number}` | 'footer'

export type PageHtmlBuildPart = {
  id: PageHtmlPartId
  phase: string
  label: string
  task: string
  section?: LayoutSectionHint
}

export type PageHtmlPartialState = {
  shell?: string
  sections: string[]
  footer?: string
}

const MAX_SECTION_PARTS = 7

export function normalizeLayoutSections(
  sections: unknown[] | undefined,
  opts?: { visualReferenceOnly?: boolean; visualProfile?: VisualBriefInference | null },
): LayoutSectionHint[] {
  if (!Array.isArray(sections) || !sections.length) {
    if (opts?.visualProfile) {
      const types =
        opts.visualProfile.sectionTypes.length > 0
          ? opts.visualProfile.sectionTypes
          : topologyDefaultSectionTypes(opts.visualProfile.layoutTopology)
      return types.map((type) => ({
        type,
        description: `Réplica fiel de la zona "${type}" visible en la captura adjunta`,
      }))
    }
    if (opts?.visualReferenceOnly) {
      return [
        {
          type: 'main-content',
          description: 'Réplica del contenido principal visible en la captura (no hero genérico)',
        },
      ]
    }
    return [
      { type: 'navigation', description: 'Cabecera y navegación sticky o estática' },
      { type: 'hero', description: 'Hero principal con titular y CTA' },
      { type: 'features', description: 'Bloque de valor / producto / contenido editorial' },
    ]
  }
  const out: LayoutSectionHint[] = []
  for (const raw of sections.slice(0, MAX_SECTION_PARTS)) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      out.push(raw as LayoutSectionHint)
    } else {
      out.push({ type: 'section', description: 'Sección de contenido' })
    }
  }
  return out.length ? out : [{ type: 'content', description: 'Contenido principal' }]
}

export function buildPageHtmlParts(
  page: OrchestrationLayoutPage,
  designMd?: string,
  modelId?: string,
  opts?: { visualReferenceOnly?: boolean; visualProfile?: VisualBriefInference | null },
): PageHtmlBuildPart[] {
  const hasDesignMd = Boolean(designMd?.trim())
  const stitchMode = isStitchParityEnabled(modelId)
  const configHint = stitchMode && designMd ? designMdTailwindConfigHint(designMd) : ''
  const sections = normalizeLayoutSections(page.sections, opts)
  const shellTask = stitchMode
    ? `Genera SOLO el inicio del documento HTML para la pantalla "${page.name ?? page.id}" (stack Google Stitch):
- <!DOCTYPE html>, <html lang="es">, <head>: charset, viewport, <title>, Google Fonts del YAML, Material Symbols si hay iconos.
- <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script> PRIMERO.
- <script id="tailwind-config">${configHint || 'tailwind.config = { darkMode: "class", theme: { extend: { colors, fontSize, fontFamily, spacing, borderRadius } } }'}</script> justo después (sin <style> entre CDN y config).
- Clases utility Tailwind en <header>/<nav> (data-sk-id sk-nav); abre <body> y <main data-sk-id="sk-main"> sin cerrar documento.
- NO uses :root vanilla extenso; NO incluyas secciones de contenido todavía.${hasDesignMd ? '\n- tailwind.config completo desde design.md (no solo colors).' : ''}`
    : `Genera SOLO el inicio del documento HTML para la pantalla "${page.name ?? page.id}":
- <!DOCTYPE html>, <html lang="es">, <head> con charset, viewport, <title>, <style> con :root y estilos base **copiados de spec/design.md** (frontmatter colors, typography, rounded, spacing).
- En :root usa los hex del YAML de design.md (primary, surface-*, on-surface, containers, etc.); tipografías Google Fonts del bloque typography.
- Estilos de header/nav/botones según ## Components y ## Shapes de design.md.
- <body> abierto, <header> o <nav> con data-sk-id (sk-nav, sk-brand).
- Abre <main data-sk-id="sk-main"> pero NO cierres </main> ni </body> ni </html>.
- NO incluyas secciones de contenido todavía.${hasDesignMd ? '\n- **No** uses colores ni fuentes que no estén en design.md.' : ''}`

  const parts: PageHtmlBuildPart[] = [
    {
      id: 'shell',
      phase: `page-part:${page.id}:shell`,
      label: 'Estructura y cabecera',
      task: shellTask,
    },
  ]

  sections.forEach((section, index) => {
    const type = section.type ?? 'section'
    const desc = section.description ?? ''
    const style = section.style ? ` estilo ${section.style}` : ''
    const comp = section.composition ? ` composición ${section.composition}` : ''
    parts.push({
      id: `section-${index}`,
      phase: `page-part:${page.id}:section-${index}`,
      label: `Sección ${type}`,
      section,
      task: stitchMode
        ? `Genera SOLO el fragmento HTML de UNA sección (${type}${style}${comp}) para insertar dentro de <main>.
${desc ? `Brief de la sección: ${desc}` : ''}
- Clases Tailwind utility (bg-*, text-*, py-*, grid, flex, rounded) con tokens del tailwind.config del shell.
- <section> con data-sk-id únicos (sk-sec-${index}-…); sin :root ni <style> global.
- Contenido denso y específico del producto (no placeholders genéricos).
- NO repitas <header>, <nav>, <!DOCTYPE>, scripts ni cierres de documento.`
        : `Genera SOLO el fragmento HTML de UNA sección (${type}${style}${comp}) para insertar dentro de <main>.
${desc ? `Brief de la sección: ${desc}` : ''}
- Colores, tipografía, radios y componentes **alineados con spec/design.md** (## Colors, ## Typography, ## Components, ## Layout & Spacing).
- Usa <section> o semántica adecuada con data-sk-id únicos (sk-sec-${index}-…).
- Botones/CTAs con roles primary/secondary/tertiary del design system; fondos surface-container-*.
- Contenido denso y específico del producto (no placeholders genéricos).
- NO repitas <header>, <nav>, <!DOCTYPE> ni cierres de documento.`,
    })
  })

  parts.push({
    id: 'footer',
    phase: `page-part:${page.id}:footer`,
    label: 'Pie y cierre',
    task: stitchMode
      ? `Genera SOLO el cierre del documento:
- <footer data-sk-id="sk-footer"> con clases Tailwind (bg-surface-container, text-on-surface-variant, etc.).
- Cierra </main> si estaba abierto, luego </body></html>.
- NO repitas cabecera ni secciones anteriores.`
      : `Genera SOLO el cierre del documento:
- <footer data-sk-id="sk-footer"> con copy breve; estilos según ## Components y ## Elevation & Depth de design.md.
- Cierra </main> si estaba abierto, luego </body></html>.
- NO repitas cabecera ni secciones anteriores.`,
  })

  return parts
}

export function pageHtmlPartSystemInstruction(
  partId: PageHtmlPartId,
  device: DesignPreviewBreakpoint,
  hasDesignMd = false,
  modelId?: string,
): string {
  const { width, height } = DESIGN_BREAKPOINT_PRESETS[device]
  const stitchMode = isStitchParityEnabled(modelId)
  const designRule = hasDesignMd
    ? `spec/design.md del usuario es la **única fuente de verdad** visual: colores M3 del YAML, tipografías, radios, espaciado y patrones de ## Components. Ante conflicto con JSON, gana design.md. `
    : 'Usa los tokens del prompt. '
  const stackRule = stitchMode
    ? 'Tailwind CDN + tailwind.config con hex del YAML; clases utility en el markup.'
    : 'Solo HTML/CSS vanilla; en shell define :root desde design.md.'
  return `Eres desarrollador frontend (PASO HTML: ${partId}). Dispositivo ${device} (~${width}×${height}px).
Construyes una pantalla **por partes** con coherencia visual. Responde ÚNICAMENTE el fragmento del paso.
${designRule}data-sk-id en elementos editables. ${stackRule}
Sin markdown fences, sin repetir partes ya generadas.`
}

function stripModelHtmlNoise(text: string): string {
  let t = text.trim()
  const fence = t.match(/```(?:html)?\s*\n?([\s\S]*?)```/i)
  if (fence?.[1]) t = fence[1].trim()
  t = t.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim()
  return t
}

export function parseHtmlPartOutput(text: string, partId: PageHtmlPartId): string | null {
  const trimmed = stripModelHtmlNoise(text)
  if (!trimmed) return null

  if (partId === 'shell') {
    if (/<!DOCTYPE|<html[\s>]/i.test(trimmed)) return trimmed
    if (/<body[\s>]/i.test(trimmed) || /<header[\s>]/i.test(trimmed)) {
      return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title></head>${trimmed}`
    }
    return trimmed
  }

  if (partId === 'footer') {
    return trimmed
  }

  const sectionMatch = trimmed.match(
    /<(section|article|div)[\s\S]*$/i,
  )
  return sectionMatch ? trimmed : `<section data-sk-id="sk-sec-block">${trimmed}</section>`
}

export function assemblePageHtmlFromParts(
  state: PageHtmlPartialState,
  designMd?: string,
): string {
  const shell = state.shell?.trim() ?? ''
  if (!shell) return ''

  let html = shell
  for (const section of state.sections) {
    const frag = section?.trim()
    if (!frag) continue
    html = insertBeforeCloseBody(html, frag)
  }

  const footer = state.footer?.trim()
  if (footer) {
    html = insertBeforeCloseBody(html, footer)
  }

  return prepareOrchestrationPageHtmlForPersist(repairTruncatedPageHtml(html), designMd)
}

function insertBeforeCloseBody(html: string, fragment: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${fragment}\n</body>`)
  }
  if (/<\/main>/i.test(html) && !/<main[^>]*>[\s\S]*<\/main>/i.test(html)) {
    return html.replace(/<\/main>/i, `${fragment}\n</main>`)
  }
  if (/<main[^>]*>/i.test(html) && !/<\/main>/i.test(html)) {
    return `${html}\n${fragment}`
  }
  return `${html}\n${fragment}`
}

export function pageHtmlExcerptForContext(html: string, maxChars?: number): string {
  const trimmed = html.trim()
  if (maxChars == null || maxChars <= 0 || trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars)}\n\n…`
}

export function isPreviewableIncrementalPageHtml(html: string): boolean {
  const prepared = prepareOrchestrationPageHtmlForPersist(html)
  if (prepared.length < 180) return false
  if (isDesignPreviewPlaceholderHtml(prepared)) return false
  return hasRenderableDocumentRoot(prepared)
}

function applyPartToState(
  state: PageHtmlPartialState,
  partId: PageHtmlPartId,
  fragment: string,
): void {
  if (partId === 'shell') state.shell = fragment
  else if (partId === 'footer') state.footer = fragment
  else if (partId.startsWith('section-')) {
    const index = Number.parseInt(partId.slice('section-'.length), 10)
    if (Number.isFinite(index) && index >= 0) {
      while (state.sections.length <= index) state.sections.push('')
      state.sections[index] = fragment
    }
  }
}

function buildPartUserPrompt(
  brief: DesignBrief,
  extraBlocks: string[],
  page: OrchestrationLayoutPage,
  part: PageHtmlBuildPart,
  state: PageHtmlPartialState,
  device: DesignPreviewBreakpoint,
  designMd?: string,
): string {
  const accumulated = assemblePageHtmlFromParts(state)
  const withoutDupDesignMd = extraBlocks.filter(
    (b) => !b.trimStart().startsWith('## spec/design.md'),
  )
  const blocks = [
    ...designMdHtmlGuidanceBlocks(designMd ?? '', part.id),
    ...withoutDupDesignMd,
    `## Pantalla: ${page.name ?? page.id} (${pageHtmlPath(page.id)})`,
    `## layoutStrategy: ${page.layoutStrategy ?? 'modular'}`,
    accumulated.length > 80
      ? `## HTML en construcción (contexto — no reescribas partes ya hechas)\n${pageHtmlExcerptForContext(accumulated)}`
      : '## HTML en construcción\n(vacío — primer fragmento)',
    `## html-part-id: ${part.id}`,
    `## Paso actual: ${part.label}\n${part.task}`,
    `Dispositivo: ${device}.`,
  ]
  return composeOrchestrationUserPrompt(brief, blocks)
}

export type SequentialPageHtmlCall = (
  prompt: string,
  opts: {
    systemInstruction: string
    modelId: string
    images?: unknown[]
    signal?: AbortSignal
  },
) => Promise<string>

export type RunMonolithicPageHtmlOpts = {
  page: OrchestrationLayoutPage
  brief: DesignBrief
  designMd?: string
  extraPromptBlocks: string[]
  device: DesignPreviewBreakpoint
  modelId: string
  images?: unknown[]
  signal?: AbortSignal
  send?: (type: string, data: string) => void
  generateImages?: boolean
  preserveExistingImages?: boolean
  callText: SequentialPageHtmlCall
}

/** Genera la pantalla en una sola llamada (design.md + imagen de referencia en el prompt). */
export async function runMonolithicPageHtmlBuild(
  opts: RunMonolithicPageHtmlOpts,
): Promise<string> {
  const {
    page,
    brief,
    designMd,
    extraPromptBlocks,
    device,
    modelId,
    images,
    signal,
    send,
    generateImages,
    preserveExistingImages,
    callText,
  } = opts

  send?.('phase', `page:${page.id}:html`)

  const withoutDupDesignMd = extraPromptBlocks.filter(
    (b) => !b.trimStart().startsWith('## spec/design.md'),
  )
  const blocks = [
    ...designMdHtmlGuidanceBlocks(designMd ?? '', 'full'),
    ...withoutDupDesignMd,
    `## Pantalla: ${page.name ?? page.id} (${pageHtmlPath(page.id)})`,
    `## layoutStrategy: ${page.layoutStrategy ?? 'modular'}`,
    `Genera UN único bloque \`\`\`html ${pageHtmlPath(page.id)}`,
    isStitchParityEnabled(modelId)
      ? 'con el HTML **completo** Stitch: Tailwind CDN, tailwind-config con colors del YAML, secciones en <main>, <footer>, </html>.'
      : 'con el HTML **completo** de esa pantalla: <!DOCTYPE html>, viewport, <style> con :root desde design.md, secciones en <main>, <footer>, </html>.',
    'Si hay imagen de referencia adjunta, replica composición, jerarquía y densidad visual.',
    'Sin markdown fuera del fence; sin fragmentos parciales.',
    `Dispositivo: ${device}.`,
  ]

  const prompt = composeOrchestrationUserPrompt(brief, blocks)
  const contentSystem = contentComponentSystemInstruction(device, [page], {
    generateImages,
    preserveExistingImages,
    hasVisualReference: Boolean(images?.length),
    modelId,
    locale: resolveOrchestrationLocale(brief),
  })

  return callText(prompt, {
    systemInstruction: contentSystem,
    modelId,
    images,
    signal,
  })
}

export type RunSequentialPageHtmlOpts = {
  page: OrchestrationLayoutPage
  brief: DesignBrief
  /** spec/design.md completo — guía obligatoria en cada paso HTML. */
  designMd?: string
  extraPromptBlocks: string[]
  device: DesignPreviewBreakpoint
  modelId: string
  images?: unknown[]
  visualProfile?: VisualBriefInference | null
  signal?: AbortSignal
  send?: (type: string, data: string) => void
  onPartPersisted?: (html: string) => Promise<void>
  callText: SequentialPageHtmlCall
}

export async function runSequentialPageHtmlBuild(
  opts: RunSequentialPageHtmlOpts,
): Promise<string> {
  const {
    page,
    brief,
    designMd,
    extraPromptBlocks,
    device,
    modelId,
    images,
    signal,
    send,
    onPartPersisted,
    callText,
  } = opts

  const hasDesignMd = Boolean(designMd?.trim())
  const hasVisualReference = Boolean(images?.length)
  const parts = buildPageHtmlParts(page, designMd, modelId, {
    visualReferenceOnly: hasVisualReference,
    visualProfile: opts.visualProfile,
  })
  const state: PageHtmlPartialState = { sections: [] }

  for (const part of parts) {
    send?.('phase', part.phase)

    const prompt = buildPartUserPrompt(
      brief,
      extraPromptBlocks,
      page,
      part,
      state,
      device,
      designMd,
    )

    let text = await callText(prompt, {
      systemInstruction: pageHtmlPartSystemInstruction(part.id, device, hasDesignMd, modelId),
      modelId,
      images,
      signal,
    })

    let fragment = parseHtmlPartOutput(text, part.id)
    if (!fragment?.trim()) {
      const retryPrompt = `${prompt}\n\n## Corrección\nResponde SOLO el fragmento del paso "${part.id}" sin fences ni texto extra. Respeta spec/design.md al pie de la letra.`
      text = await callText(retryPrompt, {
        systemInstruction: pageHtmlPartSystemInstruction(part.id, device, hasDesignMd, modelId),
        modelId,
        images,
        signal,
      })
      fragment = parseHtmlPartOutput(text, part.id)
    }

    if (fragment?.trim()) {
      applyPartToState(state, part.id, fragment)
      const assembled = assemblePageHtmlFromParts(state, designMd)
      if (isPreviewableIncrementalPageHtml(assembled)) {
        await onPartPersisted?.(assembled)
      }
    }
  }

  return assemblePageHtmlFromParts(state, designMd)
}

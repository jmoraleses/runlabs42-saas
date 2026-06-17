import { injectDesignMdThemeIntoHtml } from '@/lib/design/designMd'
import {
  isStitchStyleHtml,
  mergeStitchTailwindConfigFromDesignMd,
  normalizeStitchTailwindHeadOrder,
} from '@/lib/design/stitchParity'

function visibleTextInBodyInner(inner: string): string {
  return inner
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractBodyInnerHtml(html: string): string | null {
  const match = html.match(/<body[^>]*>([\s\S]*?)(?:<\/body>|$)/i)
  return match?.[1] ?? null
}

function extractMainInnerHtml(html: string): string | null {
  const match = html.match(/<main[^>]*>([\s\S]*?)(?:<\/main>|$)/i)
  return match?.[1] ?? null
}

function extractRenderableInnerHtml(html: string): string | null {
  return extractBodyInnerHtml(html) ?? extractMainInnerHtml(html)
}

export function hasRenderableDocumentRoot(html: string): boolean {
  return /<body[\s>]/i.test(html) || /<main[\s>]/i.test(html)
}

/** Elimina prosa del modelo antes del primer DOCTYPE / <html>. */
export function stripLeadingNonHtmlBeforeDocument(html: string): string {
  const trimmed = html.trim()
  const doctype = trimmed.search(/<!DOCTYPE\s+html/i)
  const htmlTag = trimmed.search(/<html[\s>]/i)
  const start =
    doctype >= 0 && htmlTag >= 0
      ? Math.min(doctype, htmlTag)
      : doctype >= 0
        ? doctype
        : htmlTag
  if (start > 0) return trimmed.slice(start)
  return trimmed
}

/** Corta en el primer </html> para no persistir notas ni segundo bloque del modelo. */
export function truncateAtFirstClosingHtml(html: string): string {
  const trimmed = html.trim()
  const match = trimmed.match(/<\/html\s*>/i)
  if (!match || match.index === undefined) return trimmed
  return trimmed.slice(0, match.index + match[0].length)
}

/** Extrae un documento cerrado desde un índice (p. ej. tras DOCTYPE). */
export function extractClosedHtmlFromIndex(text: string, startIdx: number): string | null {
  const slice = text.slice(startIdx).trimStart()
  if (slice.length < 200) return null
  const close = slice.match(/<\/html\s*>/i)
  if (!close || close.index === undefined) return null
  return slice.slice(0, close.index + close[0].length)
}

/** Quita <pre> o “sopa” de etiquetas que el modelo suele pegar al final del <body>. */
export function stripTrailingHtmlLeakageFromBody(html: string): string {
  const bodyMatch = html.match(/(<body[^>]*>)([\s\S]*)(<\/body>)/i)
  if (!bodyMatch) return html
  const open = bodyMatch[1]!
  let inner = bodyMatch[2]!
  const close = bodyMatch[3]!

  for (;;) {
    const preMatch = inner.match(/<pre\b[^>]*>[\s\S]*?<\/pre>\s*$/i)
    if (!preMatch) break
    const tagCount = (preMatch[0].match(/</g) ?? []).length
    if (tagCount < 8) break
    inner = inner.slice(0, inner.length - preMatch[0].length)
  }

  inner = inner.replace(/\s*```(?:html)?[^\n`]*\n[\s\S]*?```\s*$/i, '')

  const anchors = ['</footer>', '</main>', '</article>'] as const
  let cutAt = -1
  for (const anchor of anchors) {
    const idx = inner.lastIndexOf(anchor)
    if (idx >= 0) cutAt = Math.max(cutAt, idx + anchor.length)
  }
  if (cutAt >= 0) {
    const tail = inner.slice(cutAt).trim()
    const openTags = (tail.match(/<[a-z][\w-]*[\s>/]/gi) ?? []).length
    if (tail.length >= 400 && openTags >= 12) {
      inner = inner.slice(0, cutAt)
    }
  }

  if (inner === bodyMatch[2]) return html
  const before = html.slice(0, bodyMatch.index!)
  const after = html.slice(bodyMatch.index! + bodyMatch[0].length)
  return `${before}${open}${inner}${close}${after}`
}

/** Fragmento con `<main>` pero sin documento — típico en salidas largas del modelo. */
function wrapRenderableFragmentAsDocument(html: string): string {
  const trimmed = html.trim()
  if (!trimmed || /<html[\s>]/i.test(trimmed)) return trimmed
  const hasRegion = /<(?:main|header|footer|nav|section|article|div)[\s>]/i.test(trimmed)
  if (!hasRegion) return trimmed
  return (
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title></head>' +
    `<body>${trimmed}</body></html>`
  )
}

/** Envuelve `<main>` (u otras regiones) en `<body>` para preview y validación. */
export function ensureBodyShellForPreview(html: string): string {
  const trimmed = html.trim()
  if (!trimmed || /<body[\s>]/i.test(trimmed)) return trimmed
  if (!/<html[\s>]/i.test(trimmed)) return trimmed
  if (!/<(?:main|header|footer|nav|section|article)[\s>]/i.test(trimmed)) return trimmed
  if (/<\/head>/i.test(trimmed)) {
    return trimmed.replace(/<\/head>/i, '</head><body>').replace(/<\/html>/i, '</body></html>')
  }
  return trimmed.replace(/<html([^>]*)>/i, '<html$1><body>').replace(/<\/html>/i, '</body></html>')
}

/** HTML de pantalla listo para persistir en el lienzo (no fragmentos truncados). */
export function isCompleteOrchestrationPageHtml(html: string): boolean {
  const trimmed = html.trim()
  if (trimmed.length < 1200) return false
  if (!/<\/html\s*>/i.test(trimmed)) return false
  if (!hasRenderableDocumentRoot(trimmed)) return false
  const inner = extractRenderableInnerHtml(trimmed)
  if (inner != null && visibleTextInBodyInner(inner).length < 24) return false
  return true
}

/** Marcado visual denso (pocos nodos de texto, mucho HTML/CSS) — típico en salidas del modelo. */
function hasSubstantialMarkup(html: string, inner: string): boolean {
  const withoutStyles = inner
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .trim()
  return html.length >= 2000 && withoutStyles.length >= 800
}

/** Acepta HTML extenso del modelo aunque falte cerrar body (stream largo reparable). */
export function isAcceptableOrchestrationPageHtml(html: string): boolean {
  const prepared = prepareOrchestrationPageHtmlForPersist(html)
  if (isCompleteOrchestrationPageHtml(prepared)) return true
  const trimmed = prepared.trim()
  if (trimmed.length < 1200) return false
  if (!hasRenderableDocumentRoot(trimmed)) return false
  const inner = extractRenderableInnerHtml(trimmed)
  if (inner == null) return false
  if (visibleTextInBodyInner(inner).length >= 8) return true
  return hasSubstantialMarkup(trimmed, inner)
}

/** Cierra etiquetas abiertas cuando el modelo corta el stream (sin descartar el contenido). */
export function repairTruncatedPageHtml(html: string): string {
  let s = html.trim()
  if (!s) return s
  if (/<style[^>]*>/i.test(s) && !/<\/style>/i.test(s)) s += '\n</style>'
  if (/<script[^>]*>/i.test(s) && !/<\/script>/i.test(s)) s += '\n</script>'
  if (/<body[\s>]/i.test(s) && !/<\/body>/i.test(s)) s += '\n</body>'
  if (!/<\/html\s*>/i.test(s)) s += '\n</html>'
  s = ensureBodyShellForPreview(s)
  if (/<body[\s>]/i.test(s) && !/<\/body>/i.test(s)) s += '\n</body>'
  return s
}

/** Normaliza HTML extraído del modelo antes de validar o persistir. */
export function prepareOrchestrationPageHtmlForPersist(
  html: string,
  designMd?: string | null,
): string {
  let s = stripLeadingNonHtmlBeforeDocument(html.trim())
  s = truncateAtFirstClosingHtml(s)
  s = stripTrailingHtmlLeakageFromBody(s)
  s = wrapRenderableFragmentAsDocument(s)
  s = ensureBodyShellForPreview(s)
  if (!s) return s
  if (isCompleteOrchestrationPageHtml(s)) {
    return applyDesignMdThemeIfPresent(s, designMd)
  }
  s = repairTruncatedPageHtml(s)
  if (isCompleteOrchestrationPageHtml(s)) {
    return applyDesignMdThemeIfPresent(s, designMd)
  }
  return applyDesignMdThemeIfPresent(s, designMd)
}

function applyDesignMdThemeIfPresent(html: string, designMd?: string | null): string {
  if (isStitchStyleHtml(html)) {
    return mergeStitchTailwindConfigFromDesignMd(html, designMd)
  }
  if (!designMd?.trim()) return html
  return injectDesignMdThemeIntoHtml(html, designMd)
}

/** Extrae el documento HTML más grande de una respuesta del modelo (fence cerrado o no). */
export function extractLargestHtmlDocumentFromModelText(text: string): string | null {
  const candidates: string[] = []
  const fenceRe = /```[^\n]*\n([\s\S]*?)(?:```|$)/gi
  let fenceMatch: RegExpExecArray | null
  while ((fenceMatch = fenceRe.exec(text)) !== null) {
    const inner = truncateAtFirstClosingHtml(fenceMatch[1]?.trim() ?? '')
    if (inner.length >= 200 && hasRenderableDocumentRoot(inner)) candidates.push(inner)
  }
  const doctypeIdx = text.search(/<!DOCTYPE\s+html/i)
  if (doctypeIdx >= 0) {
    const closed = extractClosedHtmlFromIndex(text, doctypeIdx)
    if (closed && closed.length >= 500) candidates.push(closed)
  }
  const htmlIdx = text.search(/<html[\s>]/i)
  if (htmlIdx >= 0 && (doctypeIdx < 0 || htmlIdx < doctypeIdx)) {
    const closed = extractClosedHtmlFromIndex(text, htmlIdx)
    if (closed && closed.length >= 500) candidates.push(closed)
  }
  const mainIdx = text.search(/<main[\s>]/i)
  if (mainIdx >= 0) {
    const slice = text.slice(mainIdx).trim()
    if (slice.length >= 500) candidates.push(slice)
  }
  if (!candidates.length) return null
  const prepared = candidates.map((c) => prepareOrchestrationPageHtmlForPersist(c))
  return prepared.sort((a, b) => b.length - a.length)[0] ?? null
}

export function orchestrationPageHtmlIncompleteReason(html: string): string {
  const trimmed = html.trim()
  if (trimmed.length < 1200) return `short:${trimmed.length}`
  if (!hasRenderableDocumentRoot(trimmed)) return 'no-body-or-main'
  if (!/<\/html\s*>/i.test(trimmed)) return 'no-closing-html'
  const inner = extractRenderableInnerHtml(trimmed)
  if (inner != null) {
    const visible = visibleTextInBodyInner(inner)
    if (visible.length < 24) return `body-empty:${visible.length}`
  }
  return 'unknown'
}

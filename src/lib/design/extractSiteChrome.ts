import type { DesignPageMeta } from '@/lib/design/types'

/** Fragmentos de header/nav/footer extraídos de una página ya generada. */
export type SiteChrome = {
  sourcePageId: string
  sourcePageName: string
  header: string | null
  nav: string | null
  footer: string | null
  chromeCss: string | null
}


/** Extrae el bloque exterior de un tag balanceado (p. ej. `<header>…</header>`). */
export function extractBalancedTagOuterHtml(html: string, tag: string): string | null {
  const tagRe = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const openRe = new RegExp(`<${tagRe}\\b[^>]*>`, 'gi')
  let open = openRe.exec(html)
  if (!open) return null

  const start = open.index
  let depth = 1
  let pos = start + open[0].length
  const innerOpenRe = new RegExp(`<${tagRe}\\b[^>]*>`, 'gi')
  const closeRe = new RegExp(`</${tagRe}\\s*>`, 'gi')

  while (depth > 0 && pos < html.length) {
    innerOpenRe.lastIndex = pos
    closeRe.lastIndex = pos
    const nextOpen = innerOpenRe.exec(html)
    const nextClose = closeRe.exec(html)
    if (!nextClose) return null
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1
      pos = nextOpen.index + nextOpen[0].length
      continue
    }
    depth -= 1
    if (depth === 0) {
      return html.slice(start, nextClose.index + nextClose[0].length)
    }
    pos = nextClose.index + nextClose[0].length
  }
  return null
}

/** HTML del elemento marcado (por data-sk-id), incluyendo descendientes. */
export function extractElementHtmlBySkId(html: string, skId: string): string | null {
  const esc = skId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const attrRe = new RegExp(`\\bdata-sk-id=(["'])${esc}\\1`, 'i')
  const attrMatch = attrRe.exec(html)
  if (!attrMatch || attrMatch.index == null) return null

  const tagStart = html.lastIndexOf('<', attrMatch.index)
  if (tagStart < 0) return null

  const tagSlice = html.slice(tagStart)
  const tagNameMatch = tagSlice.match(/^<([a-zA-Z][a-zA-Z0-9-]*)\b/i)
  if (!tagNameMatch) return null
  const tag = tagNameMatch[1]!.toLowerCase()

  if (tag === 'img') {
    return tagSlice.match(/^<img\b[^>]*>/i)?.[0] ?? null
  }

  return extractBalancedTagOuterHtml(tagSlice, tag)
}

function clip(s: string): string {
  return s.trim()
}

/** Nav suelto fuera de header/main/footer (si existe). */
function extractStandaloneNav(html: string, headerHtml: string | null): string | null {
  const nav = extractBalancedTagOuterHtml(html, 'nav')
  if (!nav) return null
  if (headerHtml?.includes(nav)) return null
  const mainIdx = html.search(/<main\b/i)
  const navIdx = html.indexOf(nav)
  if (mainIdx >= 0 && navIdx > mainIdx) return null
  return nav
}

function extractStyleBlocks(html: string): string[] {
  const blocks: string[] = []
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m[1]?.trim()) blocks.push(m[1].trim())
  }
  return blocks
}

/** Reglas CSS que afectan header, nav o footer. */
export function extractChromeCssFromStyles(styleContents: string[]): string | null {
  const joined = styleContents.join('\n')
  if (!joined.trim()) return null
  const rules: string[] = []
  const ruleRe = /([^{}]+\{[^{}]*\})/g
  let m: RegExpExecArray | null
  while ((m = ruleRe.exec(joined)) !== null) {
    const block = m[1] ?? ''
    if (
      /(?:^|[\s,>+~#.[:])(?:header|footer|nav)\b|\.site-(?:header|footer|nav)\b|#(?:header|footer|nav)\b|data-sk-id=["']sk-(?:header|footer|nav)/i.test(
        block,
      )
    ) {
      rules.push(block.trim())
    }
  }
  if (!rules.length) return null
  return clip(rules.join('\n\n'))
}

export function extractSiteChromeFromHtml(
  html: string,
  source: { pageId: string; pageName: string },
): SiteChrome | null {
  const header = extractBalancedTagOuterHtml(html, 'header')
  const footer = extractBalancedTagOuterHtml(html, 'footer')
  const nav = extractStandaloneNav(html, header)
  const chromeCss = extractChromeCssFromStyles(extractStyleBlocks(html))

  if (!header && !footer && !nav) return null

  return {
    sourcePageId: source.pageId,
    sourcePageName: source.pageName,
    header: header ? clip(header) : null,
    nav: nav ? clip(nav) : null,
    footer: footer ? clip(footer) : null,
    chromeCss,
  }
}

export function formatSiteChromeForPagePrompt(
  chrome: SiteChrome,
  targetPageName: string,
): string {
  const parts: string[] = [
    `\n## Chrome del sitio (referencia obligatoria)`,
    `La pantalla "${chrome.sourcePageName}" (${chrome.sourcePageId}) ya definió la cabecera, navegación y pie del sitio.`,
    `En "${targetPageName}" debes reutilizar el MISMO markup: mismos tags, clases, data-sk-id y estilos visuales.`,
    `Copia el header/nav/footer casi literal; solo cambia el contenido único dentro de <main>.`,
    `No inventes otro menú, logo distinto ni footer diferente.`,
  ]

  if (chrome.chromeCss) {
    parts.push(
      `\n### CSS del chrome (incluir en <style> de esta página, sin cambiar selectores)\n\`\`\`css\n${chrome.chromeCss}\n\`\`\``,
    )
  }
  if (chrome.header) {
    parts.push(`\n### Header (copiar idéntico)\n\`\`\`html\n${chrome.header}\n\`\`\``)
  }
  if (chrome.nav) {
    parts.push(`\n### Nav principal (copiar idéntico)\n\`\`\`html\n${chrome.nav}\n\`\`\``)
  }
  if (chrome.footer) {
    parts.push(`\n### Footer (copiar idéntico)\n\`\`\`html\n${chrome.footer}\n\`\`\``)
  }

  return parts.join('\n')
}

const HOME_PAGE_ID_RE = /^(home|inicio|index|landing)$/i
const HOME_PAGE_NAME_RE = /^(inicio|home|página principal|pagina principal)$/i

/** Genera primero la pantalla que define header/nav/footer (suele ser Inicio). */
export function sortPagesWithHomeFirst(pages: DesignPageMeta[]): DesignPageMeta[] {
  const idx = pages.findIndex(
    (p) => HOME_PAGE_ID_RE.test(p.id) || HOME_PAGE_NAME_RE.test(p.name.trim()),
  )
  if (idx <= 0) return pages
  const ordered = [...pages]
  const [home] = ordered.splice(idx, 1)
  return [home!, ...ordered]
}

export function firstPageChromeInstruction(pageName: string): string {
  return (
    `\n## Primera pantalla del sitio ("${pageName}")` +
    `\nDefine el header, la navegación principal (enlaces del menú) y el footer que serán la plantilla canónica para TODAS las demás páginas del sitio.` +
    `\nUsa data-sk-id estables (p. ej. sk-header, sk-nav, sk-footer) y clases coherentes; las siguientes pantallas copiarán este chrome literalmente.`
  )
}

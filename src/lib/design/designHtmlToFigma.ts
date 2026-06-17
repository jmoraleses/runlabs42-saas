import 'server-only'

/** Nodo simplificado compatible con el plugin Figma companion. */
export type FigmaExportNode = {
  type: 'FRAME' | 'TEXT' | 'RECTANGLE' | 'IMAGE'
  name: string
  width?: number
  height?: number
  characters?: string
  fills?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number; a: number } }>
  children?: FigmaExportNode[]
  imageUrl?: string
}

function parseStyleAttr(style: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of style.split(';')) {
    const [k, v] = part.split(':').map((s) => s.trim())
    if (k && v) out[k.toLowerCase()] = v
  }
  return out
}

function cssColorToFigma(css: string | undefined): { r: number; g: number; b: number; a: number } | null {
  if (!css) return null
  const hex = css.match(/#([0-9a-f]{3,8})/i)?.[1]
  if (hex) {
    if (hex.length === 3) {
      const r = parseInt(`${hex[0]!}${hex[0]!}`, 16) / 255
      const g = parseInt(`${hex[1]!}${hex[1]!}`, 16) / 255
      const b = parseInt(`${hex[2]!}${hex[2]!}`, 16) / 255
      return { r, g, b, a: 1 }
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255
      const g = parseInt(hex.slice(2, 4), 16) / 255
      const b = parseInt(hex.slice(4, 6), 16) / 255
      return { r, g, b, a: 1 }
    }
  }
  const rgb = css.match(/rgba?\(([^)]+)\)/)
  if (rgb?.[1]) {
    const parts = rgb[1].split(',').map((n) => parseFloat(n.trim()))
    const p0 = parts[0] ?? 0
    const p1 = parts[1] ?? 0
    const p2 = parts[2] ?? 0
    if (parts.length >= 3) {
      return {
        r: p0 / (p0 > 1 ? 255 : 1),
        g: p1 / (p1 > 1 ? 255 : 1),
        b: p2 / (p2 > 1 ? 255 : 1),
        a: parts[3] ?? 1,
      }
    }
  }
  return null
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

type HtmlChunk = { tag: string; attrs: string; inner: string; full: string }

function topLevelChunks(html: string): HtmlChunk[] {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html
  const chunks: HtmlChunk[] = []
  const re = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    if (!m[1] || m[2] === undefined || m[3] === undefined) continue
    chunks.push({
      tag: m[1].toLowerCase(),
      attrs: m[2],
      inner: m[3],
      full: m[0],
    })
    if (chunks.length >= 80) break
  }
  return chunks
}

function attrsMap(attrs: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /(\w[\w-]*)\s*=\s*["']([^"']*)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrs))) {
    if (m[1] && m[2] !== undefined) out[m[1].toLowerCase()] = m[2]
  }
  return out
}

function chunkToNode(chunk: HtmlChunk, pageName: string): FigmaExportNode {
  const a = attrsMap(chunk.attrs)
  const style = parseStyleAttr(a.style ?? '')
  const color = cssColorToFigma(style.color ?? style['background-color'])
  const fills = color ? [{ type: 'SOLID' as const, color }] : undefined

  if (chunk.tag === 'img') {
    return {
      type: 'IMAGE',
      name: a.alt || 'Image',
      imageUrl: a.src,
      width: 200,
      height: 120,
    }
  }

  const text = stripTags(chunk.inner)
  const blockTags = new Set(['div', 'section', 'header', 'footer', 'main', 'nav', 'article'])
  if (blockTags.has(chunk.tag) && chunk.inner.includes('<')) {
    const children = topLevelChunks(chunk.inner)
      .slice(0, 30)
      .map((c, i) => chunkToNode(c, `${pageName}-${i}`))
    return {
      type: 'FRAME',
      name: a['data-sk-id'] || chunk.tag,
      width: 360,
      height: 640,
      fills,
      children: children.length ? children : undefined,
    }
  }

  if (['h1', 'h2', 'h3', 'h4', 'p', 'span', 'a', 'button', 'label'].includes(chunk.tag) && text) {
    return {
      type: 'TEXT',
      name: chunk.tag,
      characters: text.slice(0, 500),
      fills,
    }
  }

  return {
    type: 'RECTANGLE',
    name: a['data-sk-id'] || chunk.tag,
    width: 120,
    height: 40,
    fills,
  }
}

export function convertDesignHtmlToFigmaNodes(
  pageName: string,
  html: string,
): FigmaExportNode {
  const children = topLevelChunks(html).map((c, i) => chunkToNode(c, `${pageName}-${i}`))
  return {
    type: 'FRAME',
    name: pageName,
    width: 390,
    height: 844,
    children: children.length ? children : [{ type: 'TEXT', name: 'empty', characters: pageName }],
  }
}

export type FigmaExportBundle = {
  version: 1
  projectId: string
  exportedAt: string
  pages: Array<{ pageId: string; name: string; root: FigmaExportNode }>
}

export function buildFigmaExportBundle(
  projectId: string,
  pages: Array<{ pageId: string; name: string; html: string }>,
): FigmaExportBundle {
  return {
    version: 1,
    projectId,
    exportedAt: new Date().toISOString(),
    pages: pages.map((p) => ({
      pageId: p.pageId,
      name: p.name,
      root: convertDesignHtmlToFigmaNodes(p.name, p.html),
    })),
  }
}

import {
  parseAssistantSegments,
  parseFileOperationsFromStream,
} from '@/lib/ai/parseAssistantOutput'
import { DESIGN_BREAKPOINT_PRESETS, type DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import {
  brandTitleFromEnvelope,
  brandToneFromEnvelope,
  parseTokensJsonEnvelope,
  specTokensFromEnvelope,
} from '@/lib/design/normalizeDesignTokens'
import {
  autoLayoutPages,
  mergeDesignPages,
  pageHtmlPath,
  parsePageIdFromPath,
} from '@/lib/design/pages'
import { ensureDesignSystemPage } from '@/lib/design/prototypePages'
import {
  DESIGN_SITE_INDEX,
  DESIGN_SPEC_JSON,
  isDesignCanvasFilePath,
  type DesignPageMeta,
} from '@/lib/design/types'

export const DESIGN_TOKENS_PATH = 'spec/design-tokens.json'
export const DESIGN_LAYOUT_PATH = 'spec/design-layout.json'

export type OrchestrationLayoutPage = {
  id: string
  name?: string
  layoutStrategy?: string
  sections?: unknown[]
}

/** Enlace entre pantallas declarado por la IA en layout-planning. */
export type AiNavigationLink = {
  fromPageId: string
  toPageId: string
  label?: string
  /** data-sk-id sugerido para el &lt;a&gt; en la página origen. */
  anchorSkId?: string
}

export type LayoutDocument = {
  pages: OrchestrationLayoutPage[]
  navigationLinks?: AiNavigationLink[]
}

export function serializeLayoutJson(
  pages: OrchestrationLayoutPage[],
  navigationLinks?: AiNavigationLink[],
): string {
  const doc: LayoutDocument = { pages }
  if (navigationLinks?.length) doc.navigationLinks = navigationLinks
  return JSON.stringify(doc, null, 2)
}

export function parseLayoutNavigationLinks(layoutJson: string): AiNavigationLink[] {
  try {
    const parsed = JSON.parse(layoutJson) as unknown
    if (!parsed || typeof parsed !== 'object') return []
    const root = parsed as Record<string, unknown>
    const raw = root.navigationLinks ?? root.internalLinks ?? root.links
    if (!Array.isArray(raw)) return []
    const out: AiNavigationLink[] = []
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const fromPageId = String(o.fromPageId ?? o.from ?? o.sourcePageId ?? '').trim()
      const toPageId = String(o.toPageId ?? o.to ?? o.targetPageId ?? '').trim()
      if (!fromPageId || !toPageId || fromPageId === toPageId) continue
      const label = typeof o.label === 'string' ? o.label.trim() : undefined
      const anchorSkId =
        (typeof o.anchorSkId === 'string' ? o.anchorSkId.trim() : '') ||
        (typeof o.anchorHint === 'string' ? o.anchorHint.trim() : '') ||
        undefined
      out.push({ fromPageId, toPageId, label, anchorSkId })
    }
    return out
  } catch {
    return []
  }
}

/** Extrae un objeto JSON del texto del modelo (JSON puro o bloque markdown). */
export function extractJsonFromModelText(text: string): unknown | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const tryParse = (raw: string): unknown | null => {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }

  const direct = tryParse(trimmed)
  if (direct !== null) return direct

  const lenient = tryParse(trimmed.replace(/,\s*([}\]])/g, '$1'))
  if (lenient !== null) return lenient

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch?.[1]) {
    const inner = fenceMatch[1].trim()
    const fromFence = tryParse(inner) ?? tryParse(inner.replace(/,\s*([}\]])/g, '$1'))
    if (fromFence !== null) return fromFence
  }

  const firstBracket = trimmed.indexOf('[')
  const lastBracket = trimmed.lastIndexOf(']')
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const slice = trimmed.slice(firstBracket, lastBracket + 1)
    const fromArray = tryParse(slice) ?? tryParse(slice.replace(/,\s*([}\]])/g, '$1'))
    if (fromArray !== null) return fromArray
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1)
    return tryParse(slice) ?? tryParse(slice.replace(/,\s*([}\]])/g, '$1'))
  }

  return null
}

/** Convierte la respuesta del modelo en un archivo JSON canónico del workspace. */
export function jsonFileFromModelResponse(
  text: string,
  canonicalPath: string,
): { path: string; content: string } | null {
  const ops = parseFileOperationsFromStream(text)
  const fromFence = ops.find(
    (op) => op.type !== 'delete' && op.path.endsWith(canonicalPath.split('/').pop() ?? ''),
  )
  if (fromFence && fromFence.type !== 'delete') {
    return { path: canonicalPath, content: fromFence.content }
  }

  const parsed = extractJsonFromModelText(text)
  if (parsed === null) return null
  return { path: canonicalPath, content: JSON.stringify(parsed, null, 2) }
}

const LAYOUT_ROOT_KEYS = new Set([
  'pages',
  'screens',
  'views',
  'routes',
  'pageList',
  'page_list',
  'page',
  'layout',
  'layoutPlan',
  'layout_plan',
  'data',
  'structure',
  'response',
  'result',
  'metadata',
  'meta',
  'version',
  'device',
  'brand',
  'tokens',
])

function isPageLikeObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const page = value as Record<string, unknown>
  return (
    Array.isArray(page.sections) ||
    Array.isArray(page.blocks) ||
    Array.isArray(page.components) ||
    typeof page.name === 'string' ||
    typeof page.title === 'string' ||
    typeof page.layoutStrategy === 'string'
  )
}

function extractPagesFromIdMap(root: Record<string, unknown>): unknown[] | null {
  const entries = Object.entries(root).filter(([key]) => !LAYOUT_ROOT_KEYS.has(key))
  if (entries.length < 1 || entries.length > 12) return null
  if (!entries.every(([, value]) => isPageLikeObject(value))) return null
  return entries.map(([id, page]) => ({
    id: id.trim().toLowerCase(),
    ...(page as Record<string, unknown>),
  }))
}

/** Extrae el array de páginas de distintas formas que devuelve el modelo. */
export function extractLayoutPagesFromJson(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw
  if (!raw || typeof raw !== 'object') return null
  const root = raw as Record<string, unknown>
  for (const key of [
    'pages',
    'screens',
    'views',
    'routes',
    'pageList',
    'page_list',
  ] as const) {
    const value = root[key]
    if (Array.isArray(value)) return value as unknown[]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const fromMap = extractPagesFromIdMap(value as Record<string, unknown>)
      if (fromMap?.length) return fromMap
    }
  }
  const singlePage = root.page
  if (Array.isArray(singlePage)) return singlePage as unknown[]
  if (isPageLikeObject(singlePage)) {
    const id = String(singlePage.id ?? singlePage.slug ?? 'home').trim() || 'home'
    return [{ id, ...singlePage }]
  }
  const fromMap = extractPagesFromIdMap(root)
  if (fromMap?.length) return fromMap
  for (const nestedKey of ['layout', 'layoutPlan', 'layout_plan', 'data', 'structure', 'response', 'result'] as const) {
    const nested = root[nestedKey]
    if (nested && typeof nested === 'object') {
      const fromNested = extractLayoutPagesFromJson(nested)
      if (fromNested?.length) return fromNested
    }
  }
  return null
}

function normalizeLayoutPage(raw: unknown, index: number): OrchestrationLayoutPage | null {
  if (!raw || typeof raw !== 'object') return null
  const page = raw as Record<string, unknown>
  const id =
    String(page.id ?? page.slug ?? page.key ?? page.route ?? `page-${index + 1}`).trim() ||
    `page-${index + 1}`
  const name =
    typeof page.name === 'string'
      ? page.name.trim() || undefined
      : typeof page.title === 'string'
        ? page.title.trim() || undefined
        : undefined
  const sectionsRaw = page.sections ?? page.blocks ?? page.components
  const sections = Array.isArray(sectionsRaw) ? sectionsRaw : undefined
  const layoutStrategy =
    typeof page.layoutStrategy === 'string' ? page.layoutStrategy : undefined

  return {
    id,
    name,
    layoutStrategy,
    sections,
  }
}

export function parseLayoutPages(layoutJson: string): OrchestrationLayoutPage[] {
  try {
    const parsed = JSON.parse(layoutJson) as unknown
    const rawPages = extractLayoutPagesFromJson(parsed)
    if (!rawPages?.length) return []
    return rawPages
      .map((p, i) => normalizeLayoutPage(p, i))
      .filter((p): p is OrchestrationLayoutPage => Boolean(p?.id))
  } catch {
    return []
  }
}

/** Parsea layout desde la respuesta cruda del modelo (JSON, fences o mapas por id). */
export function layoutFromModelResponse(text: string): {
  layoutJson: string
  pages: OrchestrationLayoutPage[]
  navigationLinks: AiNavigationLink[]
} {
  const candidates: string[] = []
  const file = jsonFileFromModelResponse(text, DESIGN_LAYOUT_PATH)
  if (file?.content?.trim()) candidates.push(file.content)
  const extracted = extractJsonFromModelText(text)
  if (extracted !== null) candidates.push(JSON.stringify(extracted, null, 2))

  for (const candidate of candidates) {
    const pages = parseLayoutPages(candidate)
    const navigationLinks = parseLayoutNavigationLinks(candidate)
    if (pages.length) {
      return {
        layoutJson: serializeLayoutJson(pages, navigationLinks),
        pages,
        navigationLinks,
      }
    }
  }

  return { layoutJson: candidates[0] ?? '{}', pages: [], navigationLinks: [] }
}

function isCanvasHtmlPath(path: string): boolean {
  return path.endsWith('.html') && isDesignCanvasFilePath(path)
}

/** Reasigna HTML generado a rutas que el lienzo reconoce. */
export function normalizeOrchestrationHtmlFiles(
  files: Array<{ path: string; content: string }>,
  layoutPages: OrchestrationLayoutPage[],
): Array<{ path: string; content: string }> {
  const layoutIds = layoutPages.map((p) => p.id)
  const expectedPaths = layoutIds.map((id) => pageHtmlPath(id))
  const expectedSet = new Set(expectedPaths)
  const htmlFiles = files.filter((f) => f.path.endsWith('.html'))
  const nonHtml = files.filter((f) => !f.path.endsWith('.html'))

  const normalized: Array<{ path: string; content: string }> = []

  for (const file of htmlFiles) {
    let path = file.path
    if (isCanvasHtmlPath(path)) {
      normalized.push({ path, content: file.content })
      continue
    }

    if (path === 'index.html' && layoutIds.includes('home')) {
      path = DESIGN_SITE_INDEX
    } else if (layoutIds.length === 1) {
      path = pageHtmlPath(layoutIds[0]!)
    } else if (htmlFiles.length === 1 && layoutIds.length >= 1) {
      const homeIdx = layoutIds.indexOf('home')
      path = pageHtmlPath(homeIdx >= 0 ? 'home' : layoutIds[0]!)
    } else {
      const pageId = parsePageIdFromPath(path)
      if (pageId && layoutIds.includes(pageId)) {
        path = pageHtmlPath(pageId)
      }
    }

    if (!isCanvasHtmlPath(path) && expectedSet.size === 1) {
      path = expectedPaths[0]!
    }

    if (isCanvasHtmlPath(path)) {
      normalized.push({ path, content: file.content })
    }
  }

  const byPath = new Map<string, string>()
  for (const f of normalized) byPath.set(f.path, f.content)
  for (const f of nonHtml) {
    if (isDesignCanvasFilePath(f.path) || f.path.includes('/assets/')) {
      byPath.set(f.path, f.content)
    }
  }

  return [...byPath.entries()].map(([path, content]) => ({ path, content }))
}

export function layoutPagesFromHtmlFiles(
  files: Array<{ path: string; content: string }>,
): OrchestrationLayoutPage[] {
  const pages: OrchestrationLayoutPage[] = []
  for (const f of files) {
    if (!f.path.endsWith('.html') || !isCanvasHtmlPath(f.path)) continue
    const id = parsePageIdFromPath(f.path)
    if (!id) continue
    const name =
      id === 'home'
        ? 'Inicio'
        : id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    pages.push({ id, name })
  }
  return pages
}

export function synthesizeOrchestrationSpec(opts: {
  tokensJson: string
  layoutJson: string
  device: DesignPreviewBreakpoint
  htmlFiles: Array<{ path: string; content: string }>
  /** Pantallas ya en el lienzo; se fusionan sin borrar las anteriores. */
  existingPrimaryPages?: DesignPageMeta[]
}): { path: string; content: string } | null {
  const { tokensJson, layoutJson, device, htmlFiles, existingPrimaryPages } = opts
  const preset = DESIGN_BREAKPOINT_PRESETS[device]

  const envelope = parseTokensJsonEnvelope(tokensJson)
  let layoutPages = parseLayoutPages(layoutJson)

  if (!layoutPages.length) {
    layoutPages = layoutPagesFromHtmlFiles(htmlFiles)
  }

  if (!layoutPages.length) return null

  const metaPages: DesignPageMeta[] = layoutPages.map((p) => ({
    id: p.id,
    name: p.name ?? (p.id === 'home' ? 'Inicio' : p.id),
    path: pageHtmlPath(p.id),
    width: preset.width,
    height: preset.height,
    media: 'html' as const,
  }))

  const incomingPages = autoLayoutPages(metaPages)
  const mergedPages = existingPrimaryPages?.length
    ? mergeDesignPages(existingPrimaryPages, incomingPages)
    : incomingPages

  const navigationLinks = parseLayoutNavigationLinks(layoutJson)
  const prototypeLinks =
    navigationLinks.length > 0
      ? navigationLinks.map((l, i) => ({
          id: `ai-nav-${l.fromPageId}-${l.toPageId}-${i}`,
          fromPageId: l.fromPageId,
          fromSkId: l.anchorSkId ?? `sk-nav-${l.toPageId}`,
          toPageId: l.toPageId,
          label: l.label,
        }))
      : undefined

  const spec = {
    version: 2 as const,
    title: brandTitleFromEnvelope(envelope),
    summary: brandToneFromEnvelope(envelope),
    targetDevice: device,
    tokens: specTokensFromEnvelope(envelope),
    pages: mergedPages,
    ...(prototypeLinks?.length ? { prototypeLinks } : {}),
  }
  const pages = ensureDesignSystemPage(spec.pages ?? [], spec)

  return { path: DESIGN_SPEC_JSON, content: JSON.stringify({ ...spec, pages }, null, 2) }
}

export function parseOrchestrationHtmlFiles(
  htmlText: string,
  layoutPages: OrchestrationLayoutPage[],
): Array<{ path: string; content: string }> {
  const knownPaths = layoutPages.map((p) => pageHtmlPath(p.id))
  const defaultPath =
    knownPaths.find((p) => p === DESIGN_SITE_INDEX) ?? knownPaths[0] ?? DESIGN_SITE_INDEX

  const ops = parseFileOperationsFromStream(htmlText, {
    existingPaths: knownPaths,
    defaultPath,
  })

  let raw = ops
    .filter((op): op is Extract<typeof op, { type: 'create' | 'update' }> => op.type !== 'delete')
    .map((op) => ({ path: op.path, content: op.content }))

  if (!raw.length) {
    const segments = parseAssistantSegments(htmlText)
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i]!
      if (seg.kind !== 'code') continue
      const isHtml =
        seg.lang?.toLowerCase() === 'html' ||
        Boolean(seg.path?.endsWith('.html')) ||
        defaultPath.endsWith('.html')
      if (!isHtml || seg.content.trim().length < 200) continue
      const segText = seg.content.trim()
      if (!/<body[\s>]/i.test(segText) && !/<main[\s>]/i.test(segText)) continue
      raw = [{ path: seg.path ?? defaultPath, content: seg.content.trimEnd() }]
      break
    }
  }

  return normalizeOrchestrationHtmlFiles(raw, layoutPages)
}

/**
 * Al generar una sola pantalla, nunca persistir HTML en la ruta de otra
 * (p. ej. si el modelo devuelve `design/site/index.html` al pedir una página nueva).
 */
function htmlHasRenderableRoot(content: string): boolean {
  return /<body[\s>]/i.test(content) || /<main[\s>]/i.test(content)
}

export function selectOrchestrationHtmlForPage(
  files: Array<{ path: string; content: string }>,
  pageId: string,
): { path: string; content: string } | null {
  if (!files.length) return null
  const targetPath = pageHtmlPath(pageId)
  const match = files.find((f) => f.path === targetPath)
  const renderable = files.filter((f) => htmlHasRenderableRoot(f.content))
  const picked = match ?? renderable[0] ?? files[0]
  const content = picked?.content?.trim()
  if (!content) return null
  return { path: targetPath, content }
}

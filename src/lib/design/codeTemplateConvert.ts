import type { CodeTemplate } from '@/lib/codeTemplates'
import {
  enrichCmsExportFromDesign,
  normalizeCmsExportPaths,
} from '@/lib/design/cmsExportPaths'
import { buildStaticPreviewFromDesign } from '@/lib/design/buildStaticPreview'
import { resolveDesignPages } from '@/lib/design/pages'
import { parseSiteManifest, SITE_MANIFEST_PATH } from '@/lib/design/siteManifest'
import { getCmsScaffold } from '@/lib/scaffolds/cms'
import { getScaffold } from '@/lib/scaffolds'
import { loadSiteNextTemplate } from '@/lib/publish/loadSiteTemplate'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'
import { resolvePageMockupPath } from '@/lib/design/types'

export type ConvertFile = { path: string; content: string }

function dedupeByPath(files: ConvertFile[]): ConvertFile[] {
  const map = new Map<string, string>()
  for (const f of files) {
    map.set(f.path.replace(/^\/+/, ''), f.content)
  }
  return [...map.entries()].map(([path, content]) => ({ path, content }))
}

const LINK_FILE_RE = /\.(html?|php|liquid|tpl)$/i

type LinkContext = {
  aliasToRoute: Map<string, string>
  knownRoutes: Set<string>
}

type QueryParamMap = Record<string, string>
export type CodeTemplateLinkParamMap = Partial<Record<CodeTemplate, QueryParamMap>>

function toRouteSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildPageRoutes(pages: Array<{ id: string; name?: string }>): Map<string, string> {
  const routes = new Map<string, string>()
  const usedSegments = new Set<string>()
  for (const page of pages) {
    if (page.id === 'home' || page.id === 'index') {
      routes.set(page.id, '/')
      continue
    }
    const preferred = toRouteSegment(page.name ?? '') || toRouteSegment(page.id) || page.id
    let segment = preferred
    if (usedSegments.has(segment)) {
      segment = `${preferred}-${toRouteSegment(page.id) || 'page'}`
    }
    usedSegments.add(segment)
    routes.set(page.id, `/${segment}`)
  }
  return routes
}

function defaultQueryParamMapForTemplate(codeTemplate: CodeTemplate): QueryParamMap {
  switch (codeTemplate) {
    case 'wordpress':
      return {
        q: 's',
        search: 's',
      }
    case 'woocommerce':
      return {
        q: 's',
        search: 's',
        category: 'product_cat',
        brand: 'filter_pa_brand',
        color: 'filter_pa_color',
        size: 'filter_pa_size',
        price_min: 'min_price',
        price_max: 'max_price',
        sort: 'orderby',
      }
    case 'prestashop':
      return {
        q: 's',
        search: 's',
        category: 'id_category',
        brand: 'id_manufacturer',
        sort: 'order',
      }
    default:
      return {}
  }
}

function rewriteQueryForTemplate(
  suffix: string,
  codeTemplate: CodeTemplate,
  shouldRewrite: boolean,
  projectMap?: CodeTemplateLinkParamMap | null,
): string {
  if (!shouldRewrite || !suffix.startsWith('?')) return suffix
  const defaults = defaultQueryParamMapForTemplate(codeTemplate)
  const overrides = projectMap?.[codeTemplate] ?? {}
  const map: QueryParamMap = { ...defaults, ...overrides }
  if (!Object.keys(map).length) return suffix
  const source = suffix.slice(1)
  const params = new URLSearchParams(source)
  if (![...params.keys()].length) return suffix
  const next = new URLSearchParams()
  for (const [key, value] of params.entries()) {
    const mappedKey = map[key] ?? key
    next.append(mappedKey, value)
  }
  const q = next.toString()
  return q ? `?${q}` : ''
}

function buildLinkContext(designFiles: ProjectFileRecord[]): LinkContext {
  const raw = designFiles.find((f) => f.path === SITE_MANIFEST_PATH)?.content ?? null
  const manifest = parseSiteManifest(raw)
  const fallbackPages = resolveDesignPages(
    designFiles,
    designFiles.find((f) => f.path === 'spec/design.json')?.content ?? null,
  )
  const aliasToRoute = new Map<string, string>()
  const knownRoutes = new Set<string>()
  const pages =
    manifest?.pages?.length
      ? manifest.pages.map((p) => ({ id: p.id, route: p.route }))
      : fallbackPages
          .filter((p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem')
          .map((p) => ({ id: p.id, name: p.name }))
  const fallbackRoutes = buildPageRoutes(
    fallbackPages
      .filter((p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem')
      .map((p) => ({ id: p.id, name: p.name })),
  )
  for (const page of pages) {
    const route =
      ('route' in page && page.route) || fallbackRoutes.get(page.id) || (page.id === 'home' || page.id === 'index' ? '/' : `/${page.id}`)
    knownRoutes.add(route)
    const id = page.id.replace(/^\/+/, '').toLowerCase()
    aliasToRoute.set(`/pages/${id}`, route)
    aliasToRoute.set(`/pages/${id}/`, route)
    aliasToRoute.set(`/pages/${id}/index.html`, route)
    aliasToRoute.set(`/${id}`, route)
    aliasToRoute.set(`/${id}/`, route)
    aliasToRoute.set(`/${id}.html`, route)
    aliasToRoute.set(`${id}.html`, route)
    aliasToRoute.set(id, route)
    if (route !== '/') aliasToRoute.set(`${route}/${id}`, route)
  }
  aliasToRoute.set('/pages/home', '/')
  aliasToRoute.set('/pages/index', '/')
  return { aliasToRoute, knownRoutes }
}

function filePathToCurrentRoute(path: string): string {
  const norm = path.replace(/^\/+/, '')
  if (norm === 'preview/index.html') return '/'
  const m = norm.match(/^preview\/(.+)\/index\.html$/i)
  if (!m?.[1]) return '/'
  return `/${m[1].replace(/\/+/g, '/')}`
}

function normalizeInternalHrefValue(
  value: string,
  filePath: string,
  ctx: LinkContext,
  codeTemplate: CodeTemplate,
  projectMap?: CodeTemplateLinkParamMap | null,
): string {
  const href = value.trim()
  if (!href) return '/'
  if (href === '#') return '/'
  if (/^javascript:\s*void\(0\)/i.test(href)) return '/'
  if (/^(https?:|mailto:|tel:|\/\/)/i.test(href)) return href
  if (href.startsWith('#')) return href

  const currentRoute = filePathToCurrentRoute(filePath)
  let resolved = href
  try {
    const base = `https://local.test${currentRoute.endsWith('/') ? currentRoute : `${currentRoute}/`}`
    resolved = new URL(href, base).pathname + (href.includes('?') ? href.slice(href.indexOf('?')) : '')
  } catch {
    resolved = href
  }

  const [pathPart, suffix = ''] = resolved.split(/(?=[?#])/)
  const isCmsExportFile =
    codeTemplate !== 'html' && filePath.replace(/^\/+/, '').startsWith('export/')
  const rewrittenSuffix = rewriteQueryForTemplate(suffix, codeTemplate, isCmsExportFile, projectMap)
  const normalizedPath = (pathPart || '/')
    .replace(/\/index\.html$/i, '')
    .replace(/\.html$/i, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '') || '/'
  const lookup = normalizedPath.toLowerCase()
  const route = ctx.aliasToRoute.get(lookup)
  if (route) return `${route}${rewrittenSuffix}`
  if (ctx.knownRoutes.has(normalizedPath)) {
    return `${normalizedPath}${rewrittenSuffix}`
  }
  return `${normalizedPath}${rewrittenSuffix}`
}

type LinkFixItem = {
  file: string
  from: string
  to: string
  status: 'fixed' | 'unchanged'
}

function normalizeLinksInText(
  content: string,
  filePath: string,
  ctx: LinkContext,
  codeTemplate: CodeTemplate,
  projectMap?: CodeTemplateLinkParamMap | null,
): { content: string; fixes: LinkFixItem[] } {
  const fixes: LinkFixItem[] = []
  const next = content.replace(/href\s*=\s*(["'])(.*?)\1/gi, (full, quote: string, href: string) => {
    const next = normalizeInternalHrefValue(href, filePath, ctx, codeTemplate, projectMap)
    fixes.push({
      file: filePath,
      from: href,
      to: next,
      status: next === href ? 'unchanged' : 'fixed',
    })
    return `href=${quote}${next}${quote}`
  })
  return { content: next, fixes }
}

function buildLinkValidationReport(fixes: LinkFixItem[]): ConvertFile {
  const fixed = fixes.filter((f) => f.status === 'fixed')
  const unchanged = fixes.filter((f) => f.status === 'unchanged')
  const unresolved = unchanged.filter((f) => /^(#|javascript:)/i.test(f.from.trim()))
  return {
    path: 'spec/link-validation.json',
    content: JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        summary: {
          scanned: fixes.length,
          fixed: fixed.length,
          unchanged: unchanged.length,
          unresolved: unresolved.length,
        },
        fixed,
        unresolved,
      },
      null,
      2,
    ),
  }
}

function normalizeGeneratedLinksForTemplate(
  files: ConvertFile[],
  designFiles: ProjectFileRecord[],
  codeTemplate: CodeTemplate,
  projectMap?: CodeTemplateLinkParamMap | null,
): ConvertFile[] {
  const ctx = buildLinkContext(designFiles)
  const fixes: LinkFixItem[] = []
  const normalized = files.map((f) => {
    if (!LINK_FILE_RE.test(f.path)) return f
    const result = normalizeLinksInText(f.content, f.path, ctx, codeTemplate, projectMap)
    fixes.push(...result.fixes)
    return { ...f, content: result.content }
  })
  return [...normalized, buildLinkValidationReport(fixes)]
}

function buildScreenshotsFromDesign(
  designFiles: ProjectFileRecord[],
  selectedPageIds: string[],
): ConvertFile[] {
  const byPath = new Map(designFiles.map((f) => [f.path.replace(/^\/+/, ''), f.content]))
  const pages = resolveDesignPages(designFiles, byPath.get('spec/design.json') ?? null)
  const selected = new Set(selectedPageIds)
  const visiblePages =
    selected.size > 0
      ? pages.filter((p) => selected.has(p.id))
      : pages.filter((p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem')

  const out: ConvertFile[] = []
  for (const page of visiblePages) {
    const mockupPath = resolvePageMockupPath(page).replace(/^\/+/, '')
    const imagePath = page.path.endsWith('.png') ? page.path.replace(/^\/+/, '') : mockupPath
    const png = byPath.get(imagePath) ?? byPath.get(mockupPath)
    if (!png?.trim()) continue
    out.push({ path: `screenshots/${page.id}.png`, content: png })
  }
  return out
}

function buildScreenshotsManifest(
  files: ConvertFile[],
  designFiles: ProjectFileRecord[],
  selectedPageIds: string[],
): ConvertFile | null {
  const pages = resolveDesignPages(designFiles, designFiles.find((f) => f.path === 'spec/design.json')?.content ?? null)
  const selected = new Set(selectedPageIds)
  const visiblePages =
    selected.size > 0
      ? pages.filter((p) => selected.has(p.id))
      : pages.filter((p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem')
  const pageMap = new Map(visiblePages.map((p) => [p.id, p]))
  const pageRoutes = buildPageRoutes(visiblePages.map((p) => ({ id: p.id, name: p.name })))

  const entries = files
    .filter((f) => f.path.startsWith('screenshots/') && f.path.endsWith('.png'))
    .map((f) => {
      const pageId = f.path.replace(/^screenshots\//, '').replace(/\.png$/i, '')
      const page = pageMap.get(pageId)
      return {
        pageId,
        name: page?.name ?? pageId,
        path: f.path,
        route: pageRoutes.get(pageId) ?? (pageId === 'home' || pageId === 'index' ? '/' : `/${pageId}`),
        title: page?.name ?? pageId,
      }
    })
    .sort((a, b) => a.pageId.localeCompare(b.pageId))
  if (!entries.length) return null
  return {
    path: 'screenshots/manifest.json',
    content: JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        entries,
      },
      null,
      2,
    ),
  }
}

/** Fusiona salida IA + preview estático + scaffold según plantilla. */
export function mergeCodeTemplateConvertOutput(params: {
  codeTemplate: CodeTemplate
  projectName: string
  framework: string
  designFiles: ProjectFileRecord[]
  selectedPageIds: string[]
  generatedFromAi: ConvertFile[]
  codeTemplateLinkParamMap?: CodeTemplateLinkParamMap | null
}): ConvertFile[] {
  const { codeTemplate, projectName, framework, designFiles, selectedPageIds, generatedFromAi } =
    params

  const preview = buildStaticPreviewFromDesign(designFiles, selectedPageIds)
  const screenshots = buildScreenshotsFromDesign(designFiles, selectedPageIds)
  const screenshotsManifest = buildScreenshotsManifest(screenshots, designFiles, selectedPageIds)
  const screenshotsPack = screenshotsManifest ? [...screenshots, screenshotsManifest] : screenshots
  const cmsBase = getCmsScaffold(codeTemplate, projectName)
  const vercelJson: ConvertFile = {
    path: 'vercel.json',
    content: JSON.stringify(
      {
        version: 2,
        cleanUrls: true,
        trailingSlash: false,
        routes: [
          { src: '/(.*)', dest: '/preview/index.html' },
        ],
      },
      null,
      2,
    ),
  }

  const aiDeployable = normalizeCmsExportPaths(
    generatedFromAi.filter((f) => !f.path.startsWith('design/') && f.path !== 'spec/design.md'),
    codeTemplate,
  )

  if (codeTemplate === 'html') {
    const vanilla = getScaffold('vanilla', projectName).filter((f) => !f.path.startsWith('design/'))
    const htmlAi = aiDeployable.filter(
      (f) =>
        f.path.startsWith('preview/') ||
        f.path === 'index.html' ||
        f.path.endsWith('.html') ||
        f.path.endsWith('.css') ||
        f.path.endsWith('.js'),
    )
    const merged = dedupeByPath([
      ...preview,
      ...screenshotsPack,
      ...htmlAi,
      ...vanilla.map((f) => ({ path: f.path, content: f.content })),
      vercelJson,
    ])
    if (merged.some((f) => f.path === 'preview/index.html' || f.path === 'index.html')) {
      return normalizeGeneratedLinksForTemplate(
        merged,
        designFiles,
        codeTemplate,
        params.codeTemplateLinkParamMap,
      )
    }
    return normalizeGeneratedLinksForTemplate(
      dedupeByPath([...preview, ...cmsBase, vercelJson]),
      designFiles,
      codeTemplate,
      params.codeTemplateLinkParamMap,
    )
  }

  const cmsAi = aiDeployable.filter((f) => f.path.startsWith('export/') || f.path.startsWith('preview/'))
  let merged = dedupeByPath([...preview, ...screenshotsPack, ...cmsBase, ...cmsAi, vercelJson])
  merged = enrichCmsExportFromDesign(merged, codeTemplate, designFiles, projectName)

  if (merged.some((f) => f.path.startsWith('export/') || f.path.startsWith('preview/'))) {
    return normalizeGeneratedLinksForTemplate(
      merged,
      designFiles,
      codeTemplate,
      params.codeTemplateLinkParamMap,
    )
  }

  return normalizeGeneratedLinksForTemplate(
    enrichCmsExportFromDesign(
    dedupeByPath([...preview, ...cmsBase, vercelJson]),
    codeTemplate,
    designFiles,
    projectName,
    ),
    designFiles,
    codeTemplate,
    params.codeTemplateLinkParamMap,
  )
}

/** Prompt de conversión por defecto según plantilla. */
export function defaultConvertPrompt(codeTemplate: CodeTemplate): string {
  switch (codeTemplate) {
    case 'html':
      return 'Convierte el diseño aprobado en un sitio HTML estático en preview/ (páginas desde site-manifest). Conserva estilos y copy de spec/design.md.'
    case 'wordpress':
      return 'Convierte el diseño en un tema WordPress en export/wordpress/ (PHP templates, style.css, functions.php). Genera también preview/ con HTML estático fiel al diseño.'
    case 'woocommerce':
      return 'Convierte el diseño en tema WordPress + plantillas WooCommerce en export/wordpress/ y export/wordpress/woocommerce/. Incluye preview/ estático.'
    case 'shopify':
      return 'Convierte el diseño en tema Shopify Online Store 2.0 completo bajo export/shopify/theme/ (layout, templates/*.json, sections/*.liquid, assets/theme.css, config). Genera preview/ HTML estático fiel al diseño. Un archivo por ruta; no resumas en un solo README.'
    case 'prestashop':
      return 'Convierte el diseño en tema PrestaShop bajo export/prestashop/themes/ (.tpl, CSS). Incluye preview/ estático.'
    case 'joomla':
      return 'Convierte el diseño en plantilla Joomla bajo export/joomla/templates/. Incluye preview/ estático.'
    default:
      return 'Convierte el diseño aprobado según la plantilla indicada.'
  }
}

/** Si la plantilla permite fallback Next (legacy), usar solo cuando html y sin preview. */
export function shouldUseNextScaffoldFallback(
  codeTemplate: CodeTemplate,
  files: ConvertFile[],
): boolean {
  if (codeTemplate !== 'html') return false
  return !files.some((f) => f.path.startsWith('preview/') || f.path === 'index.html')
}

export function nextScaffoldFallback(projectName: string): ConvertFile[] {
  return loadSiteNextTemplate().map((f) => ({ path: f.path, content: f.content }))
}

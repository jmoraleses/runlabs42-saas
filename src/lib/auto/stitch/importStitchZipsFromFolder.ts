import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'

import { ensureSkIds } from '@/lib/design/importDesignHtml'
import { mergePagesIntoSpec, pageHtmlPath } from '@/lib/design/pages'
import {
  buildPrototypeLinksFromManifest,
  buildSiteManifest,
  SITE_MANIFEST_PATH,
} from '@/lib/design/siteManifest'
import {
  ensureDesignSystemPage,
  ensurePrototypePage,
  mergePrototypeLinks,
} from '@/lib/design/prototypePages'
import {
  buildTailwindThemeExtendFromDesignMd,
  designMdHasStitchColorTokens,
} from '@/lib/design/stitchParity'
import {
  DESIGN_SPEC_JSON,
  DESIGN_SPEC_MD,
  type DesignPageMeta,
  type DesignSpec,
} from '@/lib/design/types'
import type { ProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'

export type StitchZipPageAnalysis = {
  pageId: string
  pageName: string
  htmlEntryPath: string
  htmlSize: number
}

export type StitchZipAnalysis = {
  zipPath: string
  zipName: string
  projectTitle: string
  pages: StitchZipPageAnalysis[]
  assetCount: number
  totalBytes: number
  error?: string
}

const HTML_EXT = /\.html?$/i
const IGNORABLE_FILE = /(?:^|\/)(?:__MACOSX\/|\.DS_Store$)/i
const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.md', '.xml',
])
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.webm', '.pdf', '.zip',
])

function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function basenameWithoutExt(p: string): string {
  const base = path.posix.basename(p)
  return base.replace(/\.[^/.]+$/, '')
}

function extOf(p: string): string {
  const i = p.lastIndexOf('.')
  return i >= 0 ? p.slice(i).toLowerCase() : ''
}

function isBinary(p: string): boolean {
  const ext = extOf(p)
  if (BINARY_EXTENSIONS.has(ext)) return true
  if (TEXT_EXTENSIONS.has(ext)) return false
  return true
}

function uniqPageId(base: string, used: Set<string>): string {
  let id = base || 'page'
  let i = 1
  while (used.has(id)) {
    id = `${base}-${i++}`
  }
  used.add(id)
  return id
}

/** Directorio donde deben vivir assets relativos al HTML de la página. */
export function stitchPageAssetDir(pageId: string): string {
  if (pageId === 'home' || pageId === 'index') return 'design/site/'
  return `design/pages/${pageId}/`
}

const DESIGN_MD_ENTRY = /(?:^|\/)design\.md$/i

function pickDesignMdEntry(
  entries: JSZip.JSZipObject[],
): JSZip.JSZipObject | undefined {
  const candidates = entries.filter((e) => DESIGN_MD_ENTRY.test(e.name))
  candidates.sort((a, b) => {
    const depthA = a.name.split('/').length
    const depthB = b.name.split('/').length
    if (depthA !== depthB) return depthA - depthB
    return a.name.localeCompare(b.name)
  })
  return candidates[0]
}

function tokensFromDesignMd(markdown: string): DesignSpec['tokens'] {
  const extend = buildTailwindThemeExtendFromDesignMd(markdown)
  const c = extend.colors
  return {
    colors: {
      primary: c.primary ?? c['primary-container'] ?? '#2563eb',
      background: c.surface ?? c.background ?? '#ffffff',
      text: c['on-surface'] ?? c['on-primary'] ?? c.text ?? '#0f172a',
    },
    fonts: {
      body:
        extend.fontFamily['body-md']?.[0] ??
        extend.fontFamily['label-md']?.[0] ??
        'Inter',
      heading:
        extend.fontFamily['headline-xl']?.[0] ??
        extend.fontFamily['headline-lg']?.[0] ??
        'Inter',
    },
  }
}

function buildFallbackDesignMd(opts: {
  projectTitle: string
  zipFileName: string
  pageEntries: Array<{ pageId: string; title: string }>
  assetCount: number
}): string {
  return `# ${opts.projectTitle}

Importado desde ZIP local \`${opts.zipFileName}\` (${opts.pageEntries.length} página(s), ${opts.assetCount} asset(s)).

## Páginas
${opts.pageEntries.map((p) => `- **${p.title}** (\`${p.pageId}\`)`).join('\n')}
`
}

async function listZipFiles(folderPath: string): Promise<string[]> {
  let entries: string[] = []
  try {
    entries = await fs.readdir(folderPath)
  } catch (e) {
    throw new Error(
      `No se pudo leer la carpeta "${folderPath}": ${e instanceof Error ? e.message : 'error'}`,
    )
  }
  const out: string[] = []
  for (const name of entries) {
    if (name.startsWith('.')) continue
    if (!name.toLowerCase().endsWith('.zip')) continue
    const full = path.join(folderPath, name)
    try {
      const st = await fs.stat(full)
      if (st.isFile()) out.push(full)
    } catch {
      /* skip */
    }
  }
  out.sort()
  return out
}

async function analyzeZip(zipPath: string): Promise<StitchZipAnalysis> {
  const zipName = path.basename(zipPath)
  const projectTitle = basenameWithoutExt(zipName)
  try {
    const buf = await fs.readFile(zipPath)
    const zip = await JSZip.loadAsync(buf)
    const pages: StitchZipPageAnalysis[] = []
    const usedIds = new Set<string>()
    let assetCount = 0
    let totalBytes = 0

    const sorted = Object.values(zip.files)
      .filter((f) => !f.dir && !IGNORABLE_FILE.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Prefer index.html (or root-level html) as the first/home page.
    sorted.sort((a, b) => {
      const aIsRoot = !a.name.includes('/') && HTML_EXT.test(a.name)
      const bIsRoot = !b.name.includes('/') && HTML_EXT.test(b.name)
      if (aIsRoot && !bIsRoot) return -1
      if (!aIsRoot && bIsRoot) return 1
      return 0
    })

    for (const entry of sorted) {
      const sizeRaw = (entry as unknown as { _data?: { uncompressedSize?: number } })._data
      const sz = typeof sizeRaw?.uncompressedSize === 'number' ? sizeRaw.uncompressedSize : 0
      totalBytes += sz
      if (HTML_EXT.test(entry.name)) {
        const baseId = slugify(basenameWithoutExt(entry.name)) || `page-${pages.length + 1}`
        const pageId = pages.length === 0 ? 'home' : uniqPageId(baseId, usedIds)
        if (pageId === 'home') usedIds.add('home')
        pages.push({
          pageId,
          pageName: basenameWithoutExt(entry.name),
          htmlEntryPath: entry.name,
          htmlSize: sz,
        })
      } else {
        assetCount += 1
      }
    }

    if (!pages.length) {
      return {
        zipPath,
        zipName,
        projectTitle,
        pages: [],
        assetCount,
        totalBytes,
        error: 'El ZIP no contiene archivos HTML.',
      }
    }

    return { zipPath, zipName, projectTitle, pages, assetCount, totalBytes }
  } catch (e) {
    return {
      zipPath,
      zipName,
      projectTitle,
      pages: [],
      assetCount: 0,
      totalBytes: 0,
      error: e instanceof Error ? e.message : 'Error al leer el ZIP',
    }
  }
}

export async function analyzeStitchZipsFolder(folderPath: string): Promise<StitchZipAnalysis[]> {
  const zips = await listZipFiles(folderPath)
  return Promise.all(zips.map(analyzeZip))
}

/**
 * Importa un único ZIP al proyecto local indicado.
 * Estrategia:
 *  - cada *.html del zip pasa a ser una página (la primera = home)
 *  - todos los assets del zip (css/img/fuentes/js) se mirrorean bajo
 *    design/pages/<pageId>/<ruta-relativa> para que las refs relativas resuelvan.
 *  - también se conserva el árbol original bajo spec/inspiration/stitch/source/<zipName>/...
 */
export async function importStitchZipToProject(opts: {
  ctx: ProjectFilesContext
  zipPath: string
  projectTitle: string
}): Promise<{ pages: DesignPageMeta[]; assetCount: number }> {
  const { ctx } = opts
  const buf = await fs.readFile(opts.zipPath)
  const zip = await JSZip.loadAsync(buf)

  const entries = Object.values(zip.files)
    .filter((f) => !f.dir && !IGNORABLE_FILE.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Identifica HTMLs primero (root-html va antes).
  entries.sort((a, b) => {
    const aIsRoot = !a.name.includes('/') && HTML_EXT.test(a.name)
    const bIsRoot = !b.name.includes('/') && HTML_EXT.test(b.name)
    if (aIsRoot && !bIsRoot) return -1
    if (!aIsRoot && bIsRoot) return 1
    return 0
  })

  const htmlEntries = entries.filter((e) => HTML_EXT.test(e.name))
  if (!htmlEntries.length) {
    throw new Error(`ZIP sin archivos HTML: ${path.basename(opts.zipPath)}`)
  }

  const assetEntries = entries.filter((e) => !HTML_EXT.test(e.name) && !DESIGN_MD_ENTRY.test(e.name))

  const designMdEntry = pickDesignMdEntry(entries)
  let zipDesignMd = designMdEntry ? await designMdEntry.async('string') : ''
  zipDesignMd = zipDesignMd.trim()
  const hasZipTheme = designMdHasStitchColorTokens(zipDesignMd)

  const usedIds = new Set<string>()
  type PageEntry = { pageId: string; title: string; entry: JSZip.JSZipObject }
  const pageEntries: PageEntry[] = htmlEntries.map((e, idx) => {
    const baseId = slugify(basenameWithoutExt(e.name)) || `page-${idx + 1}`
    const pageId = idx === 0 ? 'home' : uniqPageId(baseId, usedIds)
    if (pageId === 'home') usedIds.add('home')
    return { pageId, title: basenameWithoutExt(e.name), entry: e }
  })

  const filesToWrite: Array<{ path: string; content: string }> = []
  const zipBaseName = slugify(basenameWithoutExt(path.basename(opts.zipPath))) || 'stitch-zip'

  // Mirror raíz para referencia/auditoría.
  for (const e of entries) {
    const binary = isBinary(e.name)
    const data = binary
      ? Buffer.from(await e.async('uint8array')).toString('base64')
      : await e.async('string')
    filesToWrite.push({
      path: `spec/inspiration/stitch/source/${zipBaseName}/${e.name}`,
      content: data,
    })
  }

  // Páginas + mirror de assets junto a cada página.
  for (const pe of pageEntries) {
    const html = ensureSkIds(await pe.entry.async('string'))
    filesToWrite.push({ path: pageHtmlPath(pe.pageId), content: html })

    // Copia assets junto al HTML (home → design/site/ para que el preview resuelva rutas).
    const pageDir = stitchPageAssetDir(pe.pageId)
    for (const asset of assetEntries) {
      const binary = isBinary(asset.name)
      const data = binary
        ? Buffer.from(await asset.async('uint8array')).toString('base64')
        : await asset.async('string')
      filesToWrite.push({ path: `${pageDir}${asset.name}`, content: data })
    }
  }

  await ctx.store.putMany(filesToWrite)

  // Construye páginas + manifiesto + design spec.
  const DEFAULT_W = 1440
  const DEFAULT_H = 900
  let pages: DesignPageMeta[] = pageEntries.map((pe) => ({
    id: pe.pageId,
    name: pe.title,
    path: pageHtmlPath(pe.pageId),
    media: 'html' as const,
    width: DEFAULT_W,
    height: DEFAULT_H,
    frameType: 'screen' as const,
  }))
  pages = ensureDesignSystemPage(pages, null)
  pages = ensurePrototypePage(pages, opts.projectTitle)

  const allFiles = await ctx.store.list()
  const manifest = buildSiteManifest({ designFiles: allFiles, siteType: 'ecommerce' })

  const htmlByPageId = new Map<string, string>()
  for (const pe of pageEntries) {
    const file = allFiles.find((f) => f.path === pageHtmlPath(pe.pageId))
    if (file?.content) htmlByPageId.set(pe.pageId, file.content)
  }
  const prototypeLinksFromManifest = buildPrototypeLinksFromManifest(manifest, htmlByPageId)
  const prototypeLinks =
    prototypeLinksFromManifest.length > 0
      ? prototypeLinksFromManifest
      : mergePrototypeLinks(null, pages)

  const defaultTokens: DesignSpec['tokens'] = {
    colors: { primary: '#2563eb', background: '#ffffff', text: '#0f172a' },
    fonts: { body: 'Inter', heading: 'Inter' },
  }
  const spec: DesignSpec = {
    version: 2,
    title: opts.projectTitle,
    summary: `Importado desde ZIP local "${path.basename(opts.zipPath)}"`,
    tokens: hasZipTheme ? tokensFromDesignMd(zipDesignMd) : defaultTokens,
    source: 'vertex',
    targetDevice: 'desktop',
    prototypeLinks,
    pages,
  }
  const specJson = mergePagesIntoSpec(spec, pages, opts.projectTitle)

  const zipBase = path.basename(opts.zipPath)
  const designMd = hasZipTheme
    ? zipDesignMd
    : buildFallbackDesignMd({
        projectTitle: opts.projectTitle,
        zipFileName: zipBase,
        pageEntries: pageEntries.map((p) => ({ pageId: p.pageId, title: p.title })),
        assetCount: assetEntries.length,
      })

  await ctx.store.putMany([
    { path: SITE_MANIFEST_PATH, content: JSON.stringify(manifest, null, 2) },
    { path: DESIGN_SPEC_JSON, content: specJson },
    { path: DESIGN_SPEC_MD, content: designMd },
    {
      path: `spec/inspiration/stitch/source/${zipBaseName}/_import.json`,
      content: JSON.stringify(
        {
          source: 'zip-folder',
          zipPath: opts.zipPath,
          importedAt: new Date().toISOString(),
          pages: pageEntries.map((p) => ({
            pageId: p.pageId,
            pageName: p.title,
            sourceHtml: p.entry.name,
          })),
        },
        null,
        2,
      ),
    },
  ])

  return { pages, assetCount: assetEntries.length }
}

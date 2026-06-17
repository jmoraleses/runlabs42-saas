import { mergePagesIntoSpec, pageHtmlPath } from '@/lib/design/pages'
import { loadDesignSpec, saveDesignSpec } from '@/lib/design/designSpecStore'
import { DESIGN_SPEC_JSON, type DesignPageMeta, type DesignSpec } from '@/lib/design/types'
import { applyWebStudioLayout, WEB_STUDIO_PAGES } from '@/lib/design/webStudioBlueprint'
import {
  ensureDesignSystemPage,
  ensurePrototypePage,
  mergePrototypeLinks,
} from '@/lib/design/prototypePages'
import type { ProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'

export function ensureSkIds(html: string): string {
  if (html.includes('data-sk-id')) return html
  let n = 0
  return html.replace(
    /<(h1|h2|h3|p|a|button|img|section|header|nav|main|footer|article|div)(\s)/gi,
    (_match, tag: string, sp: string) => {
      n += 1
      return `<${tag}${sp}data-sk-id="sk-auto-${n}" `
    },
  )
}

export type ImportDesignHtmlOptions = {
  pageId?: string
  pageName?: string
  html: string
  width?: number
  height?: number
  projectTitle?: string
  /** Por defecto vertex (sin metadatos Stitch). */
  source?: DesignSpec['source']
  includePrototypeLinks?: boolean
}

/** Escribe HTML de mockup + actualiza spec/design.json (sin Stitch MCP). */
export async function importDesignHtmlToWorkspace(
  ctx: ProjectFilesContext,
  _appProjectId: string,
  opts: ImportDesignHtmlOptions,
): Promise<{ pages: DesignPageMeta[]; paths: string[]; source: string }> {
  const pageId = opts.pageId ?? 'studio'
  const def = WEB_STUDIO_PAGES.find((p) => p.pageId === pageId)
  const path = pageHtmlPath(pageId)
  const html = ensureSkIds(opts.html.trim())

  const { spec } = await loadDesignSpec(ctx)
  const pageMeta: DesignPageMeta = {
    id: pageId,
    name: opts.pageName ?? def?.screenTitle ?? pageId,
    path,
    width: opts.width ?? def?.width ?? 1440,
    height: opts.height ?? def?.height ?? 900,
    frameType: 'screen',
  }

  const existingPages = (spec?.pages ?? []).filter((p) => p.id !== pageId)
  let pages = applyWebStudioLayout([...existingPages, pageMeta], WEB_STUDIO_PAGES)
  const projectTitle = opts.projectTitle ?? spec?.title ?? 'Runlabs42 Web'
  pages = ensureDesignSystemPage(pages, spec)
  pages = ensurePrototypePage(pages, projectTitle)

  const source = opts.source ?? 'vertex'
  const nextSpec: DesignSpec = {
    version: 2,
    title: projectTitle,
    summary: spec?.summary ?? 'Diseño importado.',
    tokens: spec?.tokens ?? {
      colors: { primary: '#2e3192', background: '#f8f9ff', text: '#0b1c30' },
      fonts: { body: 'Inter', heading: 'Inter' },
    },
    source,
    prototypeLinks: opts.includePrototypeLinks
      ? mergePrototypeLinks(spec, pages)
      : spec?.prototypeLinks ?? [],
    pages,
  }

  const specContent = mergePagesIntoSpec(nextSpec, pages, nextSpec.title)
  await ctx.store.putMany([
    { path, content: html },
    { path: DESIGN_SPEC_JSON, content: specContent },
  ])
  await saveDesignSpec(ctx, nextSpec)

  return { pages, paths: [path, DESIGN_SPEC_JSON], source }
}

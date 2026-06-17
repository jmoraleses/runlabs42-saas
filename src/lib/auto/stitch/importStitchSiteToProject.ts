import 'server-only'

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
  DESIGN_SPEC_JSON,
  DESIGN_SPEC_MD,
  pageMockupPath,
  type DesignPageMeta,
  type DesignSpec,
} from '@/lib/design/types'
import type { ProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import type { AutoRunSend } from '@/lib/auto/types'
import type { StitchScreenWithBuffers } from '@/lib/auto/stitch/generateFullStitchSite'

const DEFAULT_W = 1440
const DEFAULT_H = 900

function stitchDesignMd(projectTitle: string, stitchProjectId: string, screens: StitchScreenWithBuffers[]): string {
  const pageList = screens.map((s) => `- **${s.title}** (\`${s.pageId}\`)`).join('\n')
  return `# ${projectTitle}

Importado desde Google Stitch (\`${stitchProjectId}\`).

## Pantallas
${pageList}

## Navegación
Enlaces entre pantallas definidos en \`spec/design.json\` (prototypeLinks) y \`spec/site-manifest.json\`.
`
}

export async function importStitchSiteToProject(opts: {
  ctx: ProjectFilesContext
  projectTitle: string
  stitchProjectId: string
  screens: StitchScreenWithBuffers[]
  send: AutoRunSend
}): Promise<{ pages: DesignPageMeta[] }> {
  const { ctx, screens, send } = opts
  const files: Array<{ path: string; content: string }> = []

  opts.send({ phase: 'import-local-site', message: 'Importando pantallas al proyecto local…' })

  for (const s of screens) {
    const htmlPath = pageHtmlPath(s.pageId)
    const mockupPath = pageMockupPath(s.pageId)
    const html = ensureSkIds(s.html)

    files.push({ path: htmlPath, content: html })
    if (s.pngBase64) {
      files.push({ path: mockupPath, content: s.pngBase64 })
    }
    files.push({ path: s.htmlPath, content: html })
    if (s.pngBase64) {
      files.push({ path: s.pngPath, content: s.pngBase64 })
    }
    files.push({
      path: `spec/inspiration/stitch/screens/${s.screenId}/meta.json`,
      content: JSON.stringify(
        { pageId: s.pageId, screenId: s.screenId, title: s.title },
        null,
        2,
      ),
    })
  }

  let pages: DesignPageMeta[] = screens.map((s) => ({
    id: s.pageId,
    name: s.title,
    path: pageHtmlPath(s.pageId),
    mockupPath: pageMockupPath(s.pageId),
    media: 'html' as const,
    width: DEFAULT_W,
    height: DEFAULT_H,
    frameType: 'screen' as const,
  }))

  pages = ensureDesignSystemPage(pages, null)
  pages = ensurePrototypePage(pages, opts.projectTitle)

  await ctx.store.putMany(files)

  opts.send({ phase: 'wire-navigation', message: 'Generando manifiesto y enlaces para Studio…' })

  const allFiles = await ctx.store.list()
  const manifest = buildSiteManifest({ designFiles: allFiles, siteType: 'ecommerce' })

  const htmlByPageId = new Map<string, string>()
  for (const s of screens) {
    const file = allFiles.find((f) => f.path === pageHtmlPath(s.pageId))
    if (file?.content) htmlByPageId.set(s.pageId, file.content)
  }

  const prototypeLinksFromManifest = buildPrototypeLinksFromManifest(manifest, htmlByPageId)
  const prototypeLinks =
    prototypeLinksFromManifest.length > 0
      ? prototypeLinksFromManifest
      : mergePrototypeLinks(null, pages)

  const spec: DesignSpec = {
    version: 2,
    title: opts.projectTitle,
    summary: `Importado desde Stitch (${opts.stitchProjectId})`,
    tokens: {
      colors: { primary: '#2563eb', background: '#ffffff', text: '#0f172a' },
      fonts: { body: 'Inter', heading: 'Inter' },
    },
    source: 'vertex',
    targetDevice: 'desktop',
    prototypeLinks,
    pages,
  }

  const specJson = mergePagesIntoSpec(spec, pages, opts.projectTitle)

  await ctx.store.putMany([
    { path: SITE_MANIFEST_PATH, content: JSON.stringify(manifest, null, 2) },
    { path: DESIGN_SPEC_JSON, content: specJson },
    {
      path: DESIGN_SPEC_MD,
      content: stitchDesignMd(opts.projectTitle, opts.stitchProjectId, screens),
    },
    {
      path: 'spec/inspiration/stitch/run.json',
      content: JSON.stringify(
        {
          stitchProjectId: opts.stitchProjectId,
          importedAt: new Date().toISOString(),
          screens: screens.map((s) => ({
            pageId: s.pageId,
            screenId: s.screenId,
            title: s.title,
            htmlPath: pageHtmlPath(s.pageId),
            mockupPath: pageMockupPath(s.pageId),
          })),
        },
        null,
        2,
      ),
    },
  ])

  send({
    phase: 'import-local-site',
    message: `${screens.length} pantallas importadas — abre Studio para ver el lienzo`,
    counts: { screens: screens.length, links: prototypeLinks.length },
  })

  return { pages }
}

import type { ProjectFileRecord } from '@/lib/storage/projectFiles'
import { injectDesignMdThemeIntoHtml } from '@/lib/design/designMd'
import {
  isStitchStyleHtml,
  mergeStitchTailwindConfigFromDesignMd,
  normalizeStitchTailwindHeadOrder,
} from '@/lib/design/stitchParity'
import { VISUAL_EDIT_BRIDGE_SCRIPT } from '@/lib/visual-edit/bridgeScript'
import { DESIGN_SITE_INDEX, DESIGN_SPEC_MD, DESIGN_THEME_CSS_PATH } from '@/lib/design/types'
import {
  DESIGN_PREVIEW_IMAGE_LOADING_SCRIPT,
  getDesignLoadingGradientCss,
} from '@/lib/design/designLoadingGradient'

export { DESIGN_SITE_INDEX }

const DESIGN_PREVIEW_STYLE = `<style id="runlabs42-design-loading-css">${getDesignLoadingGradientCss()}</style>`
const DESIGN_PREVIEW_SCRIPTS = `<script>window.__RUNLABS42_DESIGN_PREVIEW__=true;</script><script>${DESIGN_PREVIEW_IMAGE_LOADING_SCRIPT}</script>`

/** Inyecta CSS/JS de carga en previews aunque el bridge visual ya esté presente. */
export function injectDesignPreviewBoot(html: string, previewPageId?: string | null): string {
  let out = html
  if (!out.includes('runlabs42-design-loading-css')) {
    const pageBoot = previewPageId
      ? `<script>window.__RUNLABS42_DESIGN_PAGE_ID__=${JSON.stringify(previewPageId)};</script>`
      : ''
    const boot = `${DESIGN_PREVIEW_STYLE}${DESIGN_PREVIEW_SCRIPTS}${pageBoot}`
    if (out.includes('</head>')) {
      out = out.replace('</head>', `${boot}</head>`)
    } else if (out.includes('</body>')) {
      out = out.replace('</body>', `${boot}</body>`)
    }
  }
  if (!out.includes('runlabs42-visual-edit') && out.includes('</body>')) {
    out = out.replace('</body>', `<script>${VISUAL_EDIT_BRIDGE_SCRIPT}</script></body>`)
  }
  return out
}

/**
 * Evita que enlaces del mockup (p. ej. href="/precios") naveguen fuera del preview
 * hacia rutas reales de la app en el mismo origen.
 */
export function neutralizeDesignNavigationLinks(html: string): string {
  return html.replace(
    /(<a\b[^>]*?\bhref=)(["'])(?!https?:|\/\/|\/api\/|#|javascript:|mailto:|tel:|data:)([^"']*)\2/gi,
    (_match, pre: string, quote: string, href: string) =>
      `${pre}${quote}#${quote} data-sk-design-href=${quote}${href}${quote}`,
  )
}

export function findDesignEntry(files: ProjectFileRecord[]): string | null {
  if (files.some((f) => f.path === DESIGN_SITE_INDEX)) return DESIGN_SITE_INDEX
  const alt = files.find((f) => f.path.startsWith('design/site/') && f.path.endsWith('.html'))
  return alt?.path ?? null
}

/** Reescribe rutas relativas en HTML del mockup de diseño. */
export function rewriteDesignHtml(
  html: string,
  projectId: string,
  entryPath = DESIGN_SITE_INDEX,
  cacheKey?: number,
  designMd?: string | null,
  previewPageId?: string | null,
): string {
  const entryDir = entryPath.includes('/')
    ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1)
    : ''
  const base = `/api/projects/${projectId}/design/preview/file/`
  const assetBust = cacheKey != null && cacheKey > 0 ? `?k=${cacheKey}` : ''
  const toPreviewFileUrl = (projectRelative: string) => {
    const clean = projectRelative.replace(/^\/+/, '')
    const url = `${base}${clean.split('/').map((seg) => encodeURIComponent(seg)).join('/')}`
    return assetBust ? `${url}${assetBust}` : url
  }
  const resolveRel = (p: string) => {
    if (p.startsWith('design/')) {
      return toPreviewFileUrl(p)
    }
    const rel = p.startsWith('/') ? p.slice(1) : `${entryDir}${p}`
    return toPreviewFileUrl(rel)
  }
  // Strip any leaked content after </html> (model artefact)
  const closingIdx = html.lastIndexOf('</html>')
  const sanitized = closingIdx >= 0 ? html.slice(0, closingIdx + '</html>'.length) : html

  let out = sanitized
    .replace(/(<script[^>]+src=["'])(?!https?:|\/\/|\/api\/|data:)([^"']+)(["'])/gi, (_, a, p, c) => {
      return `${a}${resolveRel(p)}${c}`
    })
    .replace(/(<link[^>]+href=["'])(?!https?:|\/\/|\/api\/|data:)([^"']+)(["'])/gi, (_, a, p, c) => {
      return `${a}${resolveRel(p)}${c}`
    })
    .replace(/(<img[^>]+src=["'])(?!https?:|\/\/|\/api\/|data:)([^"']+)(["'])/gi, (_, a, p, c) => {
      return `${a}${resolveRel(p)}${c}`
    })
    .replace(
      /url\(\s*["']?(?!https?:|\/\/|\/api\/|data:)([^"')]+)["']?\s*\)/gi,
      (_, raw: string) => `url("${resolveRel(raw.trim())}")`,
    )
  out = neutralizeDesignNavigationLinks(out)
  if (isStitchStyleHtml(out)) {
    out = mergeStitchTailwindConfigFromDesignMd(out, designMd)
  }
  const themeCssHref =
    designMd?.trim() && entryPath && !isStitchStyleHtml(out)
      ? (() => {
          const rel = DESIGN_THEME_CSS_PATH
          const url = `${base}${rel.split('/').map((seg) => encodeURIComponent(seg)).join('/')}`
          return assetBust ? `${url}${assetBust}` : url
        })()
      : undefined
  if (!isStitchStyleHtml(out)) {
    out = injectDesignMdThemeIntoHtml(out, designMd, { themeCssHref })
  }
  return injectDesignPreviewBoot(out, previewPageId)
}

/** spec/design.md del proyecto, si existe. */
export function findDesignMdContent(files: ProjectFileRecord[]): string | null {
  const raw = files.find((f) => f.path === DESIGN_SPEC_MD)?.content
  return raw?.trim() ? raw : null
}

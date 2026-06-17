import { decodeDesignBinary, isRasterImagePath } from '@/lib/design/previewBinary'

function dataUrlForProjectFile(path: string, content: string): string | null {
  if (!isRasterImagePath(path)) return null
  try {
    const { body, mimeType } = decodeDesignBinary(content)
    return `data:${mimeType};base64,${body.toString('base64')}`
  } catch {
    return null
  }
}

/** Sustituye assets locales del HTML por data URLs para captura headless sin API. */
export function inlineDesignPageAssets(
  html: string,
  pageHtmlPath: string,
  projectFiles: Array<{ path: string; content: string }>,
): string {
  const baseDir = pageHtmlPath.includes('/')
    ? pageHtmlPath.slice(0, pageHtmlPath.lastIndexOf('/') + 1)
    : ''
  const byRel = new Map<string, string>()
  for (const f of projectFiles) {
    // Match files under the page's base directory (e.g. design/pages/home/assets/...)
    if (f.path.startsWith(baseDir)) {
      const rel = f.path.slice(baseDir.length)
      const dataUrl = dataUrlForProjectFile(f.path, f.content)
      if (dataUrl) byRel.set(rel, dataUrl)
      continue
    }
    // Also match files by their relative asset suffix — HTML uses src="assets/hero.jpg"
    // but actual path might be "design/site/assets/hero.jpg"
    const assetsIdx = f.path.indexOf('/assets/')
    if (assetsIdx >= 0) {
      const rel = f.path.slice(assetsIdx + 1) // "assets/hero.jpg"
      const dataUrl = dataUrlForProjectFile(f.path, f.content)
      if (dataUrl && !byRel.has(rel)) byRel.set(rel, dataUrl)
    }
  }
  if (!byRel.size) return html

  let out = html
  for (const [rel, dataUrl] of byRel) {
    const esc = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(src=["'])(${esc})(["'])`, 'gi'), `$1${dataUrl}$3`)
    out = out.replace(
      new RegExp(`(url\\(\\s*["']?)(${esc})(["']?\\s*\\))`, 'gi'),
      `$1${dataUrl}$3`,
    )
  }
  return out
}

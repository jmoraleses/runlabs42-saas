/** Utilidades de rutas de imagen de diseño (seguras para cliente y servidor). */

const SKIP_IMG_SRC =
  /^(?:https?:|\/\/|data:|#|javascript:|mailto:|tel:|\/api\/|via\.placeholder|picsum\.photos|placehold\.co|placeholder\.com)/i

/** Rutas de proyecto para assets de mockup (design/site/… o design/pages/…). */
export function normalizeDesignImagePath(path: string): string {
  const p = path.trim().replace(/^\/+/, '')
  if (p.startsWith('design/')) return p
  if (p.startsWith('site/')) return `design/${p}`
  if (p.startsWith('assets/')) return `design/site/${p}`
  if (p.startsWith('public/images/')) {
    return `design/site/assets/${p.slice('public/images/'.length)}`
  }
  if (p.startsWith('public/')) {
    return `design/site/${p.slice('public/'.length)}`
  }
  const name = p.includes('/') ? p.split('/').pop()! : p
  return `design/site/assets/${name}`
}

function resolveImgSrcToProjectPath(src: string, pageHtmlPath: string): string {
  const trimmed = src.trim()
  if (trimmed.startsWith('design/')) return normalizeDesignImagePath(trimmed)
  const entryDir = pageHtmlPath.includes('/')
    ? pageHtmlPath.slice(0, pageHtmlPath.lastIndexOf('/') + 1)
    : ''
  if (trimmed.startsWith('/')) {
    return normalizeDesignImagePath(`design/site${trimmed}`)
  }
  return normalizeDesignImagePath(`${entryDir}${trimmed}`)
}

/** Rutas locales referenciadas por <img> en el HTML del mockup. */
export function parseDesignImagePathsFromHtml(html: string, pageHtmlPath: string): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  const imgRe = /<img\b[^>]*?\bsrc=(["'])([^"']+)\1[^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = imgRe.exec(html)) !== null) {
    const src = match[2]?.trim() ?? ''
    if (!src || SKIP_IMG_SRC.test(src)) continue
    const path = normalizeDesignImagePath(resolveImgSrcToProjectPath(src, pageHtmlPath))
    if (seen.has(path)) continue
    seen.add(path)
    paths.push(path)
  }

  return paths
}

/** Rutas de imagen que el HTML del mockup espera (tags img locales). */
export function expectedDesignPageImagePaths(
  htmlContent: string | null | undefined,
  htmlPath: string,
): string[] {
  if (!htmlContent?.trim()) return []
  return parseDesignImagePathsFromHtml(htmlContent, htmlPath)
}

export function pendingDesignPageImagePaths(
  expected: string[],
  readyPaths: Set<string> | undefined,
): string[] {
  if (!expected.length) return []
  const ready = readyPaths ?? new Set<string>()
  return expected.filter((p) => !ready.has(p))
}

/** Degradado sobre el mockup HTML mientras falte algún asset y siga la generación. */
export function shouldShowMockupAssetGradient(
  expected: string[],
  readyPaths: Set<string> | undefined,
  generating: boolean,
): boolean {
  if (!generating || !expected.length) return false
  return pendingDesignPageImagePaths(expected, readyPaths).length > 0
}

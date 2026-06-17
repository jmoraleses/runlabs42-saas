/** Sincroniza el iframe de preview con el archivo seleccionado en el árbol. */

export const PREVIEW_NAVIGATE_TYPE = 'runlabs:preview-navigate' as const

export type PreviewNavigateMessage = {
  type: typeof PREVIEW_NAVIGATE_TYPE
  path: string
}

export function isPreviewNavigateMessage(data: unknown): data is PreviewNavigateMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as PreviewNavigateMessage).type === PREVIEW_NAVIGATE_TYPE &&
    typeof (data as PreviewNavigateMessage).path === 'string'
  )
}

type WorkspaceFile = { path: string; content: string }

type StudioNavigateWindow = Window & {
  __studioNavigate?: (to: string) => void
  __studioCurrentPath?: string
}

function normPath(path: string): string {
  return path.replace(/^\/+/, '')
}

export function normRoute(route: string): string {
  if (!route || route === '/') return '/'
  const r = route.startsWith('/') ? route : `/${route}`
  return r.replace(/\/+$/, '') || '/'
}

function camelToRouteSlug(name: string): string {
  const base = name.replace(/Page$/i, '').replace(/View$/i, '')
  if (!base || /^home$/i.test(base)) return ''
  return base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}

function slugToComponentCandidates(slug: string): string[] {
  const base = slug.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase())
  const withPage = /Page$/i.test(base) ? base : `${base}Page`
  return [...new Set([base, withPage, slug])]
}

/** Archivos cuya selección debe cambiar la vista del preview. */
export function isVisualPreviewFile(filePath: string): boolean {
  const p = normPath(filePath)
  if (!/\.(tsx|jsx)$/i.test(p)) return false
  if (p === 'src/App.tsx' || p === 'src/App.jsx') return true
  if (/^(?:src\/)?pages\//i.test(p)) return true
  if (/^(?:src\/)?app\/.+\/page\.(tsx|jsx)$/i.test(p)) return true
  return false
}

/** Mapa nombre de componente → ruta desde src/App.tsx. */
function routeMapFromApp(files?: WorkspaceFile[]): Map<string, string> {
  const map = new Map<string, string>()
  const app = files?.find((f) => {
    const p = normPath(f.path)
    return p === 'src/App.tsx' || p === 'src/App.jsx'
  })
  if (!app?.content) return map

  const content = app.content

  const routePatterns = [
    /<Route\b[^>]*\bpath=["']([^"']+)["'][^>]*\belement=\{?\s*<(\w+)/gi,
    /<Route\b[^>]*\bpath=["']([^"']+)["'][^>]*\belement=\{?\s*(\w+)\s*\/?\s*\}?/gi,
  ]
  for (const routeRe of routePatterns) {
    routeRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = routeRe.exec(content)) !== null) {
      if (m[1] && m[2]) map.set(m[2], normRoute(m[1]))
    }
  }

  const importRe = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gi
  let im: RegExpExecArray | null
  while ((im = importRe.exec(content)) !== null) {
    const comp = im[1] ?? ''
    const spec = im[2] ?? ''
    if (!comp || map.has(comp)) continue

    const pagesImport = spec.match(/pages\/([^'"]+)/)
    if (pagesImport) {
      const fileSlug = pagesImport[1]!.replace(/\.[jt]sx$/i, '')
      for (const candidate of slugToComponentCandidates(fileSlug)) {
        if (map.has(candidate)) map.set(fileSlug, map.get(candidate)!)
      }
    }

    const routeForComp = new RegExp(
      `<Route\\b[^>]*\\bpath=["']([^"']+)["'][^>]*\\belement=\\{?\\s*<${comp}\\b`,
      'i',
    ).exec(content)
    if (routeForComp?.[1]) map.set(comp, normRoute(routeForComp[1]))
  }

  return map
}

function componentNameFromFile(filePath: string): string | null {
  const p = normPath(filePath)
  const pagesMatch = p.match(/^(?:src\/)?pages\/(.+)\.[jt]sx$/i)
  if (pagesMatch) {
    const slug = pagesMatch[1] ?? ''
    if (slug === 'index') return 'HomePage'
    return slug.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase())
  }
  return null
}

/** Resuelve la ruta del preview para un archivo del workspace. */
export function previewRouteForFile(
  filePath: string,
  files?: WorkspaceFile[],
): string | null {
  if (!isVisualPreviewFile(filePath)) return null

  const p = normPath(filePath)
  const routeMap = routeMapFromApp(files)

  if (p === 'src/App.tsx' || p === 'src/App.jsx') {
    return '/'
  }

  const pagesMatch = p.match(/^(?:src\/)?pages\/(.+)\.[jt]sx$/i)
  if (pagesMatch) {
    const slug = pagesMatch[1] ?? ''
    if (slug === 'index' || /^home(page)?$/i.test(slug)) return '/'

    for (const candidate of slugToComponentCandidates(slug)) {
      if (routeMap.has(candidate)) return routeMap.get(candidate)!
    }

    const compFromFile = componentNameFromFile(filePath)
    if (compFromFile && routeMap.has(compFromFile)) {
      return routeMap.get(compFromFile)!
    }

    const kebab = camelToRouteSlug(slug.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase()))
    return kebab ? normRoute(`/${kebab}`) : '/'
  }

  const appMatch = p.match(/^(?:src\/)?app\/(.+\/)?page\.[jt]sx$/i)
  if (appMatch) {
    const dir = appMatch[1] ?? ''
    if (!dir) return '/'
    const route = '/' + dir.replace(/\/$/, '').replace(/\([^)]+\)\/?/g, '')
    return normRoute(route)
  }

  return null
}

/** Archivo del workspace que corresponde a una ruta del preview. */
export function previewFileForRoute(
  route: string,
  files?: WorkspaceFile[],
): string | null {
  const target = normRoute(route)
  const list = files ?? []

  if (target === '/') {
    const homePage = list.find((f) => {
      const p = normPath(f.path)
      return /^(?:src\/)?pages\/(index|home)(?:page)?\.[jt]sx$/i.test(p)
    })
    if (homePage) return homePage.path
    const app = list.find((f) => {
      const p = normPath(f.path)
      return p === 'src/App.tsx' || p === 'src/App.jsx'
    })
    if (app) return app.path
  }

  let best: { path: string; score: number } | null = null
  for (const f of list) {
    if (!isVisualPreviewFile(f.path)) continue
    const r = previewRouteForFile(f.path, list)
    if (!r || normRoute(r) !== target) continue
    let score = 10
    if (/pages\//i.test(f.path)) score += 5
    if (!best || score > best.score) best = { path: f.path, score }
  }
  return best?.path ?? null
}

/** Ruta activa del preview (router en memoria del iframe). */
export function getPreviewRouteFromIframe(iframe: HTMLIFrameElement): string {
  const win = iframe.contentWindow as StudioNavigateWindow | null
  if (win?.__studioCurrentPath) return normRoute(win.__studioCurrentPath)
  try {
    const path = win?.location?.pathname
    if (path) return normRoute(path)
  } catch {
    /* sandbox */
  }
  return '/'
}

/** Navega el iframe del preview a una ruta (react-router shim en memoria). */
export function navigatePreviewToRoute(iframe: HTMLIFrameElement, route: string): void {
  const win = iframe.contentWindow as StudioNavigateWindow | null
  const target = normRoute(route)
  if (win?.__studioNavigate) {
    win.__studioNavigate(target)
    return
  }
  try {
    win?.history.pushState({}, '', target)
    win?.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  } catch {
    /* sandbox sin history */
  }
}

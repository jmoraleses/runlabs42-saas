import type { ProjectFileRecord } from '@/lib/storage/projectFiles'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.tsx': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

export function mimeForPath(filePath: string): string {
  const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')) : ''
  return MIME[ext.toLowerCase()] ?? 'text/plain; charset=utf-8'
}

export function findPreviewEntry(files: ProjectFileRecord[]): string | null {
  if (files.some((f) => f.path === 'preview/index.html')) return 'preview/index.html'
  if (files.some((f) => f.path === 'index.html')) return 'index.html'
  if (files.some((f) => f.path === 'public/index.html')) return 'public/index.html'
  return null
}

function previewFileUrl(projectId: string, projectRelative: string): string {
  const clean = projectRelative.replace(/^\/+/, '')
  const base = `/api/projects/${projectId}/preview/file/`
  return `${base}${clean.split('/').map((seg) => encodeURIComponent(seg)).join('/')}`
}

/** Reescribe rutas relativas en HTML para el proxy de preview. */
export function rewriteHtmlForPreview(
  html: string,
  projectId: string,
  entryPath = 'index.html',
): string {
  const entryDir = entryPath.includes('/')
    ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1)
    : ''
  const resolveRel = (p: string) => {
    const rel = p.startsWith('/') ? p.slice(1) : `${entryDir}${p}`
    return previewFileUrl(projectId, rel)
  }
  return html
    .replace(/(<script[^>]+src=["'])(?!https?:|\/\/|\/api\/)([^"']+)(["'])/gi, (_, a, p, c) => {
      return `${a}${resolveRel(p)}${c}`
    })
    .replace(/(<link[^>]+href=["'])(?!https?:|\/\/|\/api\/)([^"']+)(["'])/gi, (_, a, p, c) => {
      return `${a}${resolveRel(p)}${c}`
    })
    .replace(/(<img[^>]+src=["'])(?!https?:|\/\/|\/api\/|data:)([^"']+)(["'])/gi, (_, a, p, c) => {
      return `${a}${resolveRel(p)}${c}`
    })
    .replace(/(<a[^>]+href=["'])(?!https?:|\/\/|\/api\/|#|mailto:|tel:)([^"']+)(["'])/gi, (_, a, p, c) => {
      return `${a}${resolveRel(p)}${c}`
    })
}

export function wrapTsxModule(content: string, path: string): string {
  const escaped = content.replace(/<\/script/gi, '<\\/script')
  return `// Preview module: ${path}
${escaped}
`
}

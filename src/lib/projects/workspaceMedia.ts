import { mimeForPath } from '@/lib/mobile/previewServe'

const IMAGE_PATH_RE = /\.(png|jpe?g|gif|webp|svg|ico)$/i

export function isImageWorkspacePath(path: string): boolean {
  return IMAGE_PATH_RE.test(path)
}

/** Ruta pública servida en runtime (`/images/...` desde `public/images/...`). */
export function publicUrlFromWorkspacePath(path: string): string | null {
  const norm = path.replace(/^\/+/, '')
  if (norm.startsWith('public/')) return `/${norm.slice('public/'.length)}`
  if (norm.startsWith('images/')) return `/${norm}`
  return null
}

export function workspaceImageDataUrl(path: string, content: string): string {
  if (!content?.trim()) return ''
  const trimmed = content.trim()
  if (trimmed.startsWith('data:')) return trimmed

  if (path.endsWith('.svg') && trimmed.startsWith('<')) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`
  }

  const mime = mimeForPath(path)
  const base64 = trimmed.replace(/\s/g, '')
  return `data:${mime};base64,${base64}`
}

export function decodeWorkspaceImageContent(content: string): Uint8Array {
  const trimmed = content.trim()
  if (!trimmed) return new Uint8Array(0)

  if (trimmed.startsWith('data:')) {
    const base64 = trimmed.split(',')[1] ?? ''
    return Uint8Array.from(Buffer.from(base64, 'base64'))
  }

  return Uint8Array.from(Buffer.from(trimmed.replace(/\s/g, ''), 'base64'))
}

/** Inyecta en el iframe del preview las rutas `/images/...` del workspace. */
export function buildPublicAssetInjectionScript(
  files: Array<{ path: string; content: string }>,
): string {
  const map: Record<string, string> = {}
  for (const f of files) {
    const url = publicUrlFromWorkspacePath(f.path)
    if (!url || !isImageWorkspacePath(f.path)) continue
    const dataUrl = workspaceImageDataUrl(f.path, f.content)
    if (dataUrl) map[url] = dataUrl
  }

  if (!Object.keys(map).length) return ''

  const json = JSON.stringify(map)
  return `
window.__STUDIO_ASSETS__ = ${json};
(function () {
  function patch() {
    document.querySelectorAll('img[src]').forEach(function (img) {
      var s = img.getAttribute('src');
      if (!s || s.indexOf('data:') === 0 || s.indexOf('http') === 0) return;
      var key = s.split('?')[0];
      var u = window.__STUDIO_ASSETS__[key];
      if (u) img.src = u;
    });
  }
  patch();
  new MutationObserver(patch).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
})();
`
}

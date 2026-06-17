/** Quita páginas/enlaces legales que la IA suele añadir sin que el usuario lo pida. */

import { isImageMockupPath } from '@/lib/design/types'

const LEGAL_PAGE = /\/(pages\/)?(Privacy|Terms)\.(tsx|jsx|ts|js)$/i

export function stripLegalBoilerplateFromContent(path: string, content: string): string {
  if (LEGAL_PAGE.test(path)) return ''

  if (!/\.(tsx|jsx|ts|js|html)$/i.test(path)) return content

  let next = content
  next = next.replace(
    /<footer[^>]*>[\s\S]*?(privacidad|privacy|t[eé]rminos|terms)[\s\S]*?<\/footer>\s*/gi,
    '',
  )
  next = next.replace(
    /<nav[^>]*>[\s\S]*?(privacidad|privacy|t[eé]rminos|terms)[\s\S]*?<\/nav>\s*/gi,
    '',
  )
  next = next.replace(/<a[^>]*href=["'][^"']*\/(privacy|terms)[^"']*["'][^>]*>[\s\S]*?<\/a>\s*/gi, '')
  next = next.replace(
    /<Link[^>]*to=["']\/(privacy|terms)["'][^>]*>[\s\S]*?<\/Link>\s*/gi,
    '',
  )
  next = next.replace(/^\s*import\s+.*\/(Privacy|Terms)['"].*;\s*$/gim, '')
  next = next.replace(/^\s*import\s+.*from\s+['"]react-router-dom['"].*;\s*$/gim, (line) =>
    /BrowserRouter|Routes|Route|Link/.test(next) ? line : '',
  )

  if (/App\.(tsx|jsx)$/.test(path)) {
    next = next.replace(
      /<Route[^>]*path=["']\/(privacy|terms)["'][^>]*\/?>\s*/gi,
      '',
    )
    next = next.replace(/\s*<Route[^>]*element=\{<(?:Privacy|Terms)\s*\/>\}[^>]*\/?>\s*/gi, '')
  }

  return next.replace(/\n{3,}/g, '\n\n').trim()
}

export function stripLegalBoilerplateFromFiles<T extends { path: string; content: string }>(
  files: T[],
): T[] {
  const out: T[] = []
  for (const f of files) {
    if (LEGAL_PAGE.test(f.path)) continue
    const content = stripLegalBoilerplateFromContent(f.path, f.content)
    if (!content.trim() && /\.(tsx|jsx|ts|js)$/.test(f.path)) continue
    out.push({ ...f, content })
  }
  return out
}

/** Excluye mockups PNG del bundle de preview (evita 413 por base64 enorme). */
export function filesForCodePreview<T extends { path: string; content: string }>(
  files: T[],
): T[] {
  return stripLegalBoilerplateFromFiles(files).filter((f) => !isImageMockupPath(f.path))
}

function normPreviewPath(path: string): string {
  return path.replace(/^\/+/, '')
}

/** Rutas que no deben enviarse al bundler del Studio (design, export CMS, spec pesado). */
export function isExcludedFromStudioPreview(path: string): boolean {
  const p = normPreviewPath(path)
  if (p.startsWith('design/')) return true
  if (p === 'spec/design.md') return true
  if (p.startsWith('export/')) return true
  if (p.startsWith('spec/design') && p !== 'spec/design.json') return true
  if (p === 'vercel.json') return true
  return false
}

/**
 * Archivos para la pestaña Vista del Studio: sin mockups, sin design/export CMS.
 * Si hay `preview/index.html`, prioriza el preview estático y omite src/app React legacy.
 */
export function filesForStudioPreview<T extends { path: string; content: string }>(
  files: T[],
): T[] {
  const base = filesForCodePreview(files).filter((f) => !isExcludedFromStudioPreview(f.path))
  const hasStaticPreview = base.some((f) => normPreviewPath(f.path) === 'preview/index.html')
  if (!hasStaticPreview) return base
  return base.filter((f) => {
    const p = normPreviewPath(f.path)
    if (p.startsWith('src/') || p.startsWith('app/')) return false
    return true
  })
}

/** Script en el iframe del preview: oculta enlaces legales ya renderizados. */
export const PREVIEW_LEGAL_STRIP_SCRIPT = `
(function () {
  var reText = /(política de privacidad|privacy policy|términos de servicio|terms of service|términos de uso)/i;
  var reHref = /\\/(privacy|terms)\\b|privacidad|términos|terminos/i;
  function strip() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var t = (a.textContent || '').trim();
      var h = (a.getAttribute('href') || '').toLowerCase();
      if (!reText.test(t) && !reHref.test(h)) return;
      var block = a.closest('footer, nav, [class*="footer"], [class*="legal"]');
      if (block) {
        var links = block.querySelectorAll('a');
        if (links.length <= 4) { block.remove(); return; }
      }
      var p = a.parentElement;
      a.remove();
      if (p && p.tagName === 'P' && !(p.textContent || '').trim()) p.remove();
    });
    document.querySelectorAll('footer, nav.app-footer, .app-footer').forEach(function (el) {
      if (reText.test((el.textContent || '').trim())) el.remove();
    });
  }
  strip();
  new MutationObserver(strip).observe(document.body, { childList: true, subtree: true });
})();
`

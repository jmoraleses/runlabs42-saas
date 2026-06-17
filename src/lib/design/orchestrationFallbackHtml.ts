import { DESIGN_BREAKPOINT_PRESETS, type DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import {
  brandTitleFromEnvelope,
  parseTokensJsonEnvelope,
  specTokensFromEnvelope,
} from '@/lib/design/normalizeDesignTokens'
import { pageHtmlPath } from '@/lib/design/pages'
import { ensurePreviewableHtml } from '@/lib/design/parsePartialPageHtml'
import type { OrchestrationLayoutPage } from '@/lib/design/orchestrationParse'

/** Texto del borrador automático que no debe mostrarse en el lienzo. */
export const ORCHESTRATION_PLACEHOLDER_MARKERS = [
  'Vista generada automáticamente',
  'Contenido provisional hasta que el modelo',
  'Regenera el contenido para sustituir este borrador',
  'Vista generada automáticamente. Regenera',
] as const

export function isOrchestrationPlaceholderHtml(html: string): boolean {
  const lower = html.toLowerCase()
  return ORCHESTRATION_PLACEHOLDER_MARKERS.some((m) => lower.includes(m.toLowerCase()))
}

/** HTML mínimo con tokens cuando el modelo no devuelve un bloque parseable. */
export function buildOrchestrationFallbackHtml(
  page: Pick<OrchestrationLayoutPage, 'id' | 'name'>,
  tokensJson: string,
  device: DesignPreviewBreakpoint = 'desktop',
): { path: string; content: string } {
  const envelope = parseTokensJsonEnvelope(tokensJson)
  const tokens = specTokensFromEnvelope(envelope)
  const colors = tokens.colors ?? {}
  const primary = colors.primary ?? '#3b82f6'
  const background = colors.background ?? '#fafafa'
  const text = colors.text ?? '#111827'
  const surface = colors.surface ?? '#ffffff'
  const headingFont = tokens.fonts?.heading ?? 'system-ui, sans-serif'
  const bodyFont = tokens.fonts?.body ?? 'system-ui, sans-serif'
  const title = page.name ?? (page.id === 'home' ? 'Inicio' : page.id)
  const brand = brandTitleFromEnvelope(envelope)
  const preset = DESIGN_BREAKPOINT_PRESETS[device]
  const path = pageHtmlPath(page.id)

  const raw = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{--primary:${primary};--bg:${background};--text:${text};--surface:${surface}}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:${bodyFont};color:var(--text);background:var(--bg);line-height:1.5}
header,main,footer{max-width:${preset.width}px;margin:0 auto;padding:1.5rem}
h1{font-family:${headingFont};color:var(--primary);margin:0 0 1rem}
p{margin:0 0 1rem}
</style>
</head>
<body>
<header data-sk-id="sk-nav"><strong data-sk-id="sk-brand">${brand}</strong></header>
<main data-sk-id="sk-main">
<h1 data-sk-id="sk-h1">${title}</h1>
<p data-sk-id="sk-lead">Vista generada automáticamente. Regenera el contenido para sustituir este borrador.</p>
<section data-sk-id="sk-features" aria-label="Destacados">
<article data-sk-id="sk-f1"><h2>Sección principal</h2><p>Contenido provisional hasta que el modelo devuelva el diseño completo de esta pantalla.</p></article>
<article data-sk-id="sk-f2"><h2>Componentes</h2><p>Los tokens de color y tipografía ya están aplicados en esta vista de respaldo.</p></article>
<article data-sk-id="sk-f3"><h2>Siguiente paso</h2><p>Pulsa regenerar o envía un nuevo prompt para reemplazar este HTML.</p></article>
</section>
</main>
<footer data-sk-id="sk-footer"><small data-sk-id="sk-copy">© ${brand}</small></footer>
</body>
</html>`

  return { path, content: ensurePreviewableHtml(raw) }
}

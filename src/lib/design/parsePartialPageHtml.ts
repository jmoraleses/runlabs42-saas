import { parseAssistantSegments, parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'
import { pageHtmlPath } from '@/lib/design/pages'
import type { DesignPageMeta } from '@/lib/design/types'

/** Envuelve fragmentos sin documento para que el iframe del preview pueda pintarlos. */
export function ensurePreviewableHtml(content: string): string {
  if (/<!doctype\s+html|<html[\s>]/i.test(content)) return content
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}</style></head><body>${content}</body></html>`
}

/**
 * HTML de una pantalla: bloque completo o contenido parcial del fence abierto durante el stream.
 */
export function parsePartialSinglePageHtml(
  text: string,
  page: DesignPageMeta,
): { path: string; content: string } | null {
  const htmlPath = page.path.endsWith('.html') ? page.path : pageHtmlPath(page.id)
  const ops = parseFileOperationsFromStream(text, {
    defaultPath: htmlPath,
    existingPaths: [htmlPath],
  })
  const complete = ops.find(
    (o): o is Extract<(typeof ops)[number], { type: 'create' | 'update' }> =>
      o.type !== 'delete' && o.path.endsWith('.html') && Boolean(o.content?.trim()),
  )
  if (complete?.content?.trim()) {
    return { path: complete.path, content: complete.content.trim() }
  }

  const segments = parseAssistantSegments(text)
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!
    if (seg.kind !== 'code') continue
    const isHtml =
      seg.lang?.toLowerCase() === 'html' ||
      Boolean(seg.path?.endsWith('.html')) ||
      htmlPath.endsWith('.html')
    if (!isHtml) continue
    const raw = seg.content.trim()
    if (raw.length < 60) continue
    return { path: htmlPath, content: ensurePreviewableHtml(raw) }
  }
  return null
}

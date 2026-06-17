import {
  pageHtmlPath,
  pageMockupPath,
  resolveDesignPages,
} from '@/lib/design/pages'
import type { AiNavigationLink, OrchestrationLayoutPage } from '@/lib/design/orchestrationParse'
import { serializeLayoutJson } from '@/lib/design/orchestrationParse'
import {
  DESIGN_SPEC_JSON,
  isImageMockupPath,
  type DesignPageMeta,
} from '@/lib/design/types'
import { isRasterImagePath } from '@/lib/design/previewBinary'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'

/** Pantallas de producto (excluye design system, prototipo y variantes alt). */
export function isExistingPrimaryDesignPage(p: DesignPageMeta): boolean {
  return (
    p.frameType !== 'prototype' &&
    p.frameType !== 'designSystem' &&
    !/-alt-\d+$/.test(p.id)
  )
}

/** Páginas con HTML o mockup ya persistido (no solo planificadas en el spec). */
export function loadExistingPrimaryPages(
  existing?: ProjectFileRecord[],
): DesignPageMeta[] {
  if (!existing?.length) return []
  const specRaw = existing.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
  const filePaths = new Set(existing.map((f) => f.path))
  return resolveDesignPages(existing, specRaw)
    .filter(isExistingPrimaryDesignPage)
    .filter((p) => {
      const htmlPath = pageHtmlPath(p.id)
      const mockupPath = p.mockupPath ?? pageMockupPath(p.id)
      return (
        filePaths.has(htmlPath) ||
        (p.path.endsWith('.html') && filePaths.has(p.path)) ||
        filePaths.has(mockupPath) ||
        (isImageMockupPath(p.path) && filePaths.has(p.path))
      )
    })
}

export function existingPrimaryPageIds(existing?: ProjectFileRecord[]): Set<string> {
  return new Set(loadExistingPrimaryPages(existing).map((p) => p.id))
}

/** Id único para una pantalla nueva en el lienzo (nunca reutiliza ids existentes). */
export function allocateNewDesignPageId(existing: DesignPageMeta[]): string {
  const ids = new Set(existing.map((p) => p.id))
  const ts = Date.now().toString(36)
  let id = `screen-${ts}`
  let n = 0
  while (ids.has(id)) {
    id = `screen-${ts}-${++n}`
  }
  return id
}

export function newPageNameFromPrompt(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, ' ').slice(0, 48)
  return cleaned.length >= 3 ? cleaned : 'Nueva pantalla'
}

export function referencePageHtmlExcerpt(
  existing: ProjectFileRecord[] | undefined,
  referencePageId: string,
  maxChars?: number,
): string {
  if (!referencePageId.trim() || !existing?.length) return ''
  const htmlPath = pageHtmlPath(referencePageId)
  const file = existing.find((f) => f.path === htmlPath)
  const html = file?.content?.trim()
  if (!html) return ''
  const excerpt =
    maxChars == null || maxChars <= 0 || html.length <= maxChars
      ? html
      : `${html.slice(0, maxChars)}\n\n…`
  return [
    `## Pantalla de referencia (${referencePageId})`,
    'El usuario quiere una variación nueva en el lienzo inspirada en esta pantalla (NO la sobrescribas).',
    excerpt,
  ].join('\n\n')
}

export function orchestrationElementContextsBlock(
  contexts: Array<{ skId: string; tagName: string; text?: string }>,
): string {
  if (!contexts.length) return ''
  if (contexts.length === 1) {
    const c = contexts[0]!
    return (
      `\n## Elemento objetivo en la referencia\n` +
      `<${c.tagName}> data-sk-id="${c.skId}"` +
      (c.text ? ` texto="${c.text}"` : '') +
      '\nReplica la intención del cambio en la NUEVA pantalla (mismo rol visual, nuevo layout si hace falta).'
    )
  }
  return (
    `\n## Elementos objetivo en la referencia\n` +
    contexts
      .map(
        (c, i) =>
          `${i + 1}. <${c.tagName}> data-sk-id="${c.skId}"` +
          (c.text ? ` texto="${c.text}"` : ''),
      )
      .join('\n') +
    '\nReplica la intención en la NUEVA pantalla.'
  )
}

/** Bloque de prompt: el layout solo debe proponer pantallas nuevas. */
export function existingDesignPagesLayoutPromptBlock(
  existingPrimary: DesignPageMeta[],
): string {
  if (!existingPrimary.length) return ''
  const lines = existingPrimary.map(
    (p) => `- ${p.id}: ${p.name ?? p.id}`,
  )
  return [
    '## Diseño existente (NO reemplazar)',
    'Pantallas ya creadas en el lienzo — NO las incluyas en "pages" del JSON:',
    ...lines,
    'Genera ÚNICAMENTE páginas NUEVAS que el usuario pida o que falten para el producto.',
    'Cada page.id nuevo debe ser slug en minúsculas y no repetir los ids listados arriba.',
  ].join('\n')
}

/**
 * Combina layout del modelo con pantallas ya persistidas.
 * Devuelve el layout completo para el spec y las páginas que aún necesitan HTML.
 */
export function mergeOrchestrationLayoutWithExisting(
  incoming: OrchestrationLayoutPage[] | undefined,
  existingPrimary: DesignPageMeta[] | undefined,
  incomingNavigationLinks?: AiNavigationLink[],
): {
  layoutPages: OrchestrationLayoutPage[]
  pagesToBuild: OrchestrationLayoutPage[]
  layoutJson: string
  navigationLinks: AiNavigationLink[]
} {
  const incomingPages = Array.isArray(incoming) ? incoming : []
  const existing = Array.isArray(existingPrimary) ? existingPrimary : []

  const existingIds = new Set(existing.map((p) => p.id))
  const novel = incomingPages.filter((p) => p.id && !existingIds.has(p.id))

  const existingAsLayout: OrchestrationLayoutPage[] = existing.map((p) => ({
    id: p.id,
    name: p.name ?? (p.id === 'home' ? 'Inicio' : p.id),
  }))

  const layoutPages = [...existingAsLayout, ...novel]
  const pagesToBuild = novel

  const navigationLinks = incomingNavigationLinks ?? []

  return {
    layoutPages,
    pagesToBuild,
    layoutJson: serializeLayoutJson(layoutPages, navigationLinks),
    navigationLinks,
  }
}

/**
 * Con captura de referencia: solo las páginas de la auditoría (no mezclar Inicio/Catálogo previos).
 */
export function mergeOrchestrationLayoutExclusiveVisualReference(
  incoming: OrchestrationLayoutPage[],
  navigationLinks?: AiNavigationLink[],
): {
  layoutPages: OrchestrationLayoutPage[]
  pagesToBuild: OrchestrationLayoutPage[]
  layoutJson: string
  navigationLinks: AiNavigationLink[]
} {
  const pages = incoming.filter((p) => p.id?.trim())
  const links = navigationLinks ?? []
  return {
    layoutPages: pages,
    pagesToBuild: pages,
    layoutJson: serializeLayoutJson(pages, links),
    navigationLinks: links,
  }
}

export function seedOrchestrationFilesFromExisting(
  existing?: ProjectFileRecord[],
): Array<{ path: string; content: string }> {
  if (!existing?.length) return []
  const out: Array<{ path: string; content: string }> = []
  for (const f of existing) {
    if (
      f.path === DESIGN_SPEC_JSON ||
      f.path.startsWith('spec/design') ||
      f.path.startsWith('design/site') ||
      f.path.startsWith('design/pages') ||
      f.path.startsWith('design/mockups')
    ) {
      if (isRasterImagePath(f.path) && !f.content?.trim()) continue
      out.push({ path: f.path, content: f.content })
    }
  }
  return out
}

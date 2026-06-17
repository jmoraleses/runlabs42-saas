import {
  DESIGN_BREAKPOINT_PRESETS,
  type DesignPreviewBreakpoint,
} from '@/lib/design/breakpoints'
import { autoLayoutPages, pageHtmlPath } from '@/lib/design/pages'
import { suggestPageHeightFromMeta } from '@/lib/design/pageHeight'
import type { DesignPageMeta, DesignSpec } from '@/lib/design/types'

const SINGLE_PAGE_HINT =
  /\b(landing\s+(page|única)?|una\s+sola\s+página|single[-\s]page|one[-\s]page|solo\s+(la\s+)?página\s+de\s+inicio|only\s+home|sin\s+páginas\s+adicionales)\b/i

const PRIMARY_SCREEN = (p: DesignPageMeta) =>
  p.frameType !== 'prototype' &&
  p.frameType !== 'designSystem' &&
  !/-alt-\d+$/.test(p.id)

type PageBlueprint = { id: string; name: string }

function blueprintsForBrief(text: string): PageBlueprint[] {
  const t = text.toLowerCase()
  if (/\b(e-?commerce|tienda\s+online|shop|catálogo|catalogo|productos)\b/.test(t)) {
    return [
      { id: 'catalog', name: 'Catálogo' },
      { id: 'product', name: 'Producto' },
      { id: 'cart', name: 'Carrito' },
      { id: 'checkout', name: 'Checkout' },
    ]
  }
  if (/\b(saas|software|plataforma|app\s+web|dashboard)\b/.test(t)) {
    return [
      { id: 'features', name: 'Características' },
      { id: 'pricing', name: 'Precios' },
      { id: 'login', name: 'Iniciar sesión' },
      { id: 'dashboard', name: 'Panel' },
    ]
  }
  if (/\b(blog|noticias|artículos|revista)\b/.test(t)) {
    return [
      { id: 'articles', name: 'Artículos' },
      { id: 'article', name: 'Artículo' },
      { id: 'about', name: 'Acerca de' },
    ]
  }
  return [
    { id: 'features', name: 'Características' },
    { id: 'pricing', name: 'Precios' },
    { id: 'about', name: 'Nosotros' },
    { id: 'contact', name: 'Contacto' },
  ]
}

export function isExplicitSinglePageBrief(prompt: string, summary?: string): boolean {
  return SINGLE_PAGE_HINT.test(`${prompt}\n${summary ?? ''}`)
}

/**
 * Si el plan solo trae inicio (u otra pantalla única), añade pantallas típicas del producto
 * salvo que el brief pida explícitamente una landing de una sola página.
 */
export function expandSparseDesignPlanPages(
  pages: DesignPageMeta[],
  opts: { prompt: string; spec: DesignSpec; device: DesignPreviewBreakpoint },
): DesignPageMeta[] {
  const screenPages = pages.filter(PRIMARY_SCREEN)
  if (screenPages.length >= 2) return pages
  if (isExplicitSinglePageBrief(opts.prompt, opts.spec.summary)) return pages

  const { width } = DESIGN_BREAKPOINT_PRESETS[opts.device]
  const existingIds = new Set(screenPages.map((p) => p.id))
  const brief = `${opts.prompt}\n${opts.spec.summary ?? ''}\n${opts.spec.title ?? ''}`
  const additions: DesignPageMeta[] = []

  for (const bp of blueprintsForBrief(brief)) {
    if (existingIds.has(bp.id)) continue
    existingIds.add(bp.id)
    additions.push({
      id: bp.id,
      name: bp.name,
      path: pageHtmlPath(bp.id),
      media: 'html',
      width,
      height: suggestPageHeightFromMeta({ id: bp.id, name: bp.name }, opts.device),
    })
    if (screenPages.length + additions.length >= 4) break
  }

  if (!additions.length) return pages

  const laidOut = autoLayoutPages([...screenPages, ...additions])
  const nonScreen = pages.filter((p) => !PRIMARY_SCREEN(p))
  return [...nonScreen, ...laidOut]
}

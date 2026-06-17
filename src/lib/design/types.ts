import { CMS_EXPORT_MARKERS, type CodeTemplate } from '@/lib/codeTemplates'

export type DesignTokens = {
  colors?: Record<string, string>
  fonts?: { body?: string; heading?: string; label?: string }
  radius?: string
  spacing?: string
  sections?: string[]
  /** light | dark — afecta fondo/texto generados desde la semilla. */
  colorMode?: 'light' | 'dark'
}

export type DesignFrameType = 'designSystem' | 'screen' | 'prototype'

export type DesignPageRegion = {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
}

export type PrototypeLink = {
  id: string
  fromPageId: string
  fromSkId: string
  toPageId: string
  label?: string
}

export type DesignPageMedia = 'html' | 'image'

export type DesignPageMeta = {
  id: string
  name: string
  path: string
  width?: number
  height?: number
  x?: number
  y?: number
  frameType?: DesignFrameType
  /** html = mockup HTML editable; image = PNG Imagen 4 (pipeline GCP). */
  media?: DesignPageMedia
  /** Prompt en inglés para Imagen 4. */
  imagePrompt?: string
  /** PNG de referencia cuando path apunta a HTML editable (pipeline vertex-imagen). */
  mockupPath?: string
  aspectRatio?: '16:9' | '9:16' | '4:3' | '3:4' | '1:1'
  regions?: DesignPageRegion[]
}

/** Variante de diseño en `design/variants/{id}/`. */
export type DesignVariant = { id: string }

export type DesignReferenceImage = {
  id: string
  blobUrl: string
  mimeType: string
  name: string
  createdAt: string
}

export type DesignSpec = {
  version: 1 | 2
  title: string
  summary: string
  tokens: DesignTokens
  tone?: string
  breakpoints?: { sm?: number; md?: number; lg?: number }
  pages?: DesignPageMeta[]
  /** Dispositivo con el que se generó el mockup (desktop por defecto). */
  targetDevice?: 'desktop' | 'tablet' | 'mobile'
  /** Motor de generación: Vertex AI (Gemini + Imagen 4). */
  source?: 'vertex' | 'vertex-imagen' | 'legacy' | 'figma'
  prototypeLinks?: PrototypeLink[]
  /** Referencias visuales subidas (bocetos, capturas) en Vercel Blob. */
  referenceImages?: DesignReferenceImage[]
  /** Última importación desde Figma. */
  figmaImport?: { fileKey: string; fileName?: string; importedAt: string }
}

export const DESIGN_MOCKUPS_PREFIX = 'design/mockups/'
export const DESIGN_SITE_INDEX = 'design/site/index.html'
export const DESIGN_PAGES_PREFIX = 'design/pages/'
export const DESIGN_SPEC_JSON = 'spec/design.json'
export const DESIGN_SPEC_MD = 'spec/design.md'
/** CSS global derivado de spec/design.md (inyectado en cada mockup HTML). */
export const DESIGN_THEME_CSS_PATH = 'design/system/theme.css'
export const DESIGN_VARIANTS_PREFIX = 'design/variants/'

export function pageMockupPath(pageId: string): string {
  return `${DESIGN_MOCKUPS_PREFIX}${pageId}.png`
}

/** Sufijo de id en el lienzo para el marco PNG de referencia (par del HTML editable). */
export const DESIGN_MOCKUP_CANVAS_SUFFIX = '--mockup'

export function isMockupCompanionCanvasPage(page: Pick<DesignPageMeta, 'id'>): boolean {
  return page.id.endsWith(DESIGN_MOCKUP_CANVAS_SUFFIX)
}

/** Id lógico de pantalla (sin sufijo de marco mockup en el lienzo). */
export function canvasPrimaryPageId(pageId: string): string {
  return isMockupCompanionCanvasPage({ id: pageId })
    ? pageId.slice(0, -DESIGN_MOCKUP_CANVAS_SUFFIX.length)
    : pageId
}

/** Id persistido en spec/design.json (sin mockup de lienzo ni variantes `-alt-N`). */
export function designSpecPageId(pageId: string): string {
  let id = canvasPrimaryPageId(pageId)
  const alt = /^(.+)-alt-\d+$/.exec(id)
  if (alt?.[1]) id = alt[1]
  return id
}

export function isCanvasImagePage(page: DesignPageMeta): boolean {
  if (page.media === 'html') return false
  if (page.path.endsWith('.html')) return false
  return page.media === 'image' || page.path.endsWith('.png')
}

export function resolvePageMockupPath(page: DesignPageMeta): string {
  return page.mockupPath ?? pageMockupPath(page.id)
}

export function isImageMockupPath(path: string): boolean {
  return path.startsWith(DESIGN_MOCKUPS_PREFIX) && path.endsWith('.png')
}

/** Archivos que representan una pantalla en el lienzo del Studio (HTML o PNG). */
export function isDesignCanvasFilePath(path: string): boolean {
  return (
    path === DESIGN_SITE_INDEX ||
    (path.startsWith(DESIGN_PAGES_PREFIX) && path.endsWith('/index.html')) ||
    isImageMockupPath(path)
  )
}

export function isDesignPhasePath(path: string): boolean {
  return (
    path === DESIGN_SPEC_JSON ||
    path === DESIGN_SPEC_MD ||
    path.startsWith('design/site/') ||
    path.startsWith('design/pages/') ||
    path.startsWith(DESIGN_MOCKUPS_PREFIX) ||
    path.startsWith(DESIGN_VARIANTS_PREFIX) ||
    path.startsWith('spec/design/mockups/')
  )
}

function pathMatchesCmsExport(path: string, template: CodeTemplate): boolean {
  const markers = CMS_EXPORT_MARKERS[template]
  return markers.some((m) => path === m || path.startsWith(m))
}

export function hasAppSourceFiles(paths: string[]): boolean {
  if (
    paths.some(
      (p) =>
        p === 'preview/index.html' ||
        p.startsWith('preview/') && p.endsWith('.html'),
    )
  ) {
    return true
  }

  const cmsTemplates: CodeTemplate[] = [
    'wordpress',
    'shopify',
    'woocommerce',
    'prestashop',
    'joomla',
  ]
  for (const tpl of cmsTemplates) {
    if (paths.some((p) => pathMatchesCmsExport(p, tpl))) return true
  }

  return paths.some(
    (p) =>
      (p.startsWith('src/') && /\.(tsx|jsx|ts|js|vue|svelte)$/.test(p)) ||
      (p.startsWith('app/') && /\.(tsx|jsx)$/.test(p)) ||
      p === 'index.html' ||
      p === 'public/index.html',
  )
}

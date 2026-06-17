/** Plantillas de exportación en fase 2 (código) — independientes de `framework` técnico. */
export const CODE_TEMPLATES = [
  'html',
  'wordpress',
  'shopify',
  'woocommerce',
  'prestashop',
  'joomla',
] as const

export type CodeTemplate = (typeof CODE_TEMPLATES)[number]

export const DEFAULT_CODE_TEMPLATE: CodeTemplate = 'html'

export type CodeTemplateMeta = {
  id: CodeTemplate
  labelKey: string
  glyph: string
  exportPrefix: string | null
  /** Carpeta de preview estático desplegable en Vercel */
  previewRoot: 'preview' | 'public' | 'root'
}

export const CODE_TEMPLATE_META: Record<CodeTemplate, CodeTemplateMeta> = {
  html: {
    id: 'html',
    labelKey: 'ed.design.codeTemplate.html',
    glyph: '◉',
    exportPrefix: null,
    previewRoot: 'preview',
  },
  wordpress: {
    id: 'wordpress',
    labelKey: 'ed.design.codeTemplate.wordpress',
    glyph: 'W',
    exportPrefix: 'export/wordpress',
    previewRoot: 'preview',
  },
  shopify: {
    id: 'shopify',
    labelKey: 'ed.design.codeTemplate.shopify',
    glyph: 'S',
    exportPrefix: 'export/shopify',
    previewRoot: 'preview',
  },
  woocommerce: {
    id: 'woocommerce',
    labelKey: 'ed.design.codeTemplate.woocommerce',
    glyph: 'WC',
    exportPrefix: 'export/wordpress',
    previewRoot: 'preview',
  },
  prestashop: {
    id: 'prestashop',
    labelKey: 'ed.design.codeTemplate.prestashop',
    glyph: 'P',
    exportPrefix: 'export/prestashop',
    previewRoot: 'preview',
  },
  joomla: {
    id: 'joomla',
    labelKey: 'ed.design.codeTemplate.joomla',
    glyph: 'J',
    exportPrefix: 'export/joomla',
    previewRoot: 'preview',
  },
}

export function isValidCodeTemplate(value: string): value is CodeTemplate {
  return (CODE_TEMPLATES as readonly string[]).includes(value)
}

export function normalizeCodeTemplate(value: string | null | undefined): CodeTemplate {
  const v = String(value ?? '').trim().toLowerCase()
  return isValidCodeTemplate(v) ? v : DEFAULT_CODE_TEMPLATE
}

/** Rutas que indican artefactos CMS generados (fase 2 completada). */
export const CMS_EXPORT_MARKERS: Record<CodeTemplate, string[]> = {
  html: ['preview/index.html', 'index.html'],
  wordpress: ['export/wordpress/style.css', 'export/wordpress/functions.php'],
  shopify: ['export/shopify/theme/layout/theme.liquid'],
  woocommerce: [
    'export/wordpress/style.css',
    'export/wordpress/woocommerce/',
  ],
  prestashop: ['export/prestashop/themes/'],
  joomla: ['export/joomla/templates/'],
}

export function codeTemplateUsesNextBackend(_template: CodeTemplate): boolean {
  return false
}

import type { CodeTemplate } from '@/lib/codeTemplates'
import { CODE_TEMPLATE_META } from '@/lib/codeTemplates'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'
import { DESIGN_THEME_CSS_PATH } from '@/lib/design/types'

export type ExportFile = { path: string; content: string }

const SHOPIFY_THEME_PREFIX = 'export/shopify/theme/'

const SHOPIFY_ROOT_DIRS = new Set([
  'layout',
  'templates',
  'sections',
  'snippets',
  'assets',
  'config',
  'locales',
])

/** Corrige rutas que el modelo emite sin el prefijo `export/`. */
export function normalizeCmsExportPaths(
  files: ExportFile[],
  codeTemplate: CodeTemplate,
): ExportFile[] {
  const meta = CODE_TEMPLATE_META[codeTemplate]
  const exportPrefix = meta.exportPrefix
  if (!exportPrefix) return files.map((f) => ({ path: f.path.replace(/^\/+/, ''), content: f.content }))

  return files.map((f) => {
    let path = f.path.replace(/^\/+/, '')
    if (path.startsWith('export/')) return { path, content: f.content }

    if (codeTemplate === 'shopify') {
      if (path.startsWith('export/shopify/')) return { path, content: f.content }
      if (path.startsWith('shopify/theme/')) path = `export/${path}`
      else if (path.startsWith('theme/')) path = `export/shopify/${path}`
      else if (SHOPIFY_ROOT_DIRS.has(path.split('/')[0] ?? '')) {
        path = `${SHOPIFY_THEME_PREFIX}${path}`
      }
    } else if (codeTemplate === 'wordpress' || codeTemplate === 'woocommerce') {
      if (path.startsWith('wordpress/')) path = `export/${path}`
      else if (
        /\.(php|css)$/.test(path) &&
        !path.includes('/') &&
        ['style.css', 'functions.php', 'index.php', 'header.php', 'footer.php'].includes(path)
      ) {
        path = `export/wordpress/${path}`
      }
    } else if (codeTemplate === 'prestashop' && path.startsWith('themes/')) {
      path = `export/prestashop/${path}`
    } else if (codeTemplate === 'joomla' && path.startsWith('templates/')) {
      path = `export/joomla/${path}`
    } else if (!path.startsWith('preview/') && !path.startsWith('spec/') && exportPrefix) {
      const tail = path.startsWith(`${exportPrefix}/`) ? path : `${exportPrefix}/${path}`
      path = tail.replace(/\/+/g, '/')
    }

    return { path, content: f.content }
  })
}

/** Copia tokens CSS del diseño a assets del tema cuando la IA no los generó. */
export function enrichCmsExportFromDesign(
  files: ExportFile[],
  codeTemplate: CodeTemplate,
  designFiles: ProjectFileRecord[],
  projectName: string,
): ExportFile[] {
  const themeCss = designFiles.find((f) => f.path === DESIGN_THEME_CSS_PATH)?.content?.trim()
  if (!themeCss) return files

  const out = [...files]
  const has = (p: string) => out.some((f) => f.path === p)

  if (codeTemplate === 'shopify') {
    const assetPath = `${SHOPIFY_THEME_PREFIX}assets/theme.css`
    if (!has(assetPath)) {
      out.push({
        path: assetPath,
        content: `/* ${projectName} — desde design/system/theme.css */\n${themeCss}\n`,
      })
    }
  }

  if (codeTemplate === 'wordpress' || codeTemplate === 'woocommerce') {
    const stylePath = 'export/wordpress/style.css'
    const existing = out.find((f) => f.path === stylePath)
    if (existing && !existing.content.includes(themeCss.slice(0, 40))) {
      existing.content = `${existing.content.trim()}\n\n/* Tokens del diseño */\n${themeCss}\n`
    } else if (!existing) {
      out.push({
        path: stylePath,
        content: `/*
Theme Name: ${projectName}
Author: Runlabs
Version: 1.0.0
*/

${themeCss}
`,
      })
    }
  }

  const slug = projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'runlabs-theme'
  if (codeTemplate === 'prestashop') {
    const cssPath = `export/prestashop/themes/${slug}/assets/css/theme.css`
    if (!has(cssPath)) {
      out.push({ path: cssPath, content: `/* ${projectName} */\n${themeCss}\n` })
    }
  }

  if (codeTemplate === 'joomla') {
    const cssPath = `export/joomla/templates/${slug}/css/template.css`
    if (!has(cssPath)) {
      out.push({ path: cssPath, content: `${themeCss}\n` })
    }
  }

  return out
}

export function defaultPathForCodeTemplate(codeTemplate: CodeTemplate): string {
  switch (codeTemplate) {
    case 'shopify':
      return 'export/shopify/theme/layout/theme.liquid'
    case 'wordpress':
    case 'woocommerce':
      return 'export/wordpress/style.css'
    case 'prestashop':
      return 'export/prestashop/themes/runlabs-theme/templates/index.tpl'
    case 'joomla':
      return 'export/joomla/templates/runlabs-theme/index.php'
    default:
      return 'preview/index.html'
  }
}

import JSZip from 'jszip'
import type { CodeTemplate } from '@/lib/codeTemplates'
import { normalizeCodeTemplate } from '@/lib/codeTemplates'
import { zipProjectFileEntry } from '@/lib/projects/zipProjectFileEntry'

type ProjectFile = { path: string; content: string }

const IMPORT_README = `# Importación a plataforma

Este ZIP contiene los archivos del tema en la raíz (formato que espera la tienda al subir un tema).
El proyecto completo (preview/, spec/, design/) está en el ZIP principal del proyecto.
`

/** Añade ZIPs listos para subir en Admin (Shopify, etc.) dentro del ZIP del proyecto. */
export async function appendPlatformImportBundles(
  zip: JSZip,
  files: ProjectFile[],
  codeTemplate: CodeTemplate | null | undefined,
): Promise<void> {
  const tpl = normalizeCodeTemplate(codeTemplate ?? undefined)
  if (tpl === 'shopify') {
    await appendStrippedThemeZip(zip, files, 'export/shopify/theme/', 'import/shopify-theme.zip')
  }
  if (tpl === 'wordpress' || tpl === 'woocommerce') {
    await appendStrippedThemeZip(zip, files, 'export/wordpress/', 'import/wordpress-theme.zip')
  }
  if (tpl === 'prestashop') {
    const themeDir = files
      .map((f) => f.path.replace(/^\/+/, ''))
      .find((p) => p.startsWith('export/prestashop/themes/') && p.includes('/templates/'))
    if (themeDir) {
      const prefix = themeDir.slice(0, themeDir.indexOf('/templates/'))
      await appendStrippedThemeZip(zip, files, `${prefix}/`, 'import/prestashop-theme.zip')
    }
  }
  if (tpl === 'joomla') {
    const prefix =
      files
        .map((f) => f.path.replace(/^\/+/, ''))
        .find((p) => p.startsWith('export/joomla/templates/') && p.endsWith('/index.php'))
        ?.replace(/index\.php$/, '') ?? null
    if (prefix) {
      await appendStrippedThemeZip(zip, files, prefix, 'import/joomla-template.zip')
    }
  }
}

async function appendStrippedThemeZip(
  outer: JSZip,
  files: ProjectFile[],
  stripPrefix: string,
  destPath: string,
): Promise<void> {
  const normalizedPrefix = stripPrefix.replace(/^\/+/, '')
  const themeFiles = files.filter((f) => {
    const p = f.path.replace(/^\/+/, '')
    return p.startsWith(normalizedPrefix) && !p.endsWith('.md')
  })
  if (themeFiles.length < 2) return

  const inner = new JSZip()
  inner.file('README-IMPORT.md', IMPORT_README)
  for (const f of themeFiles) {
    const rel = f.path.replace(/^\/+/, '').slice(normalizedPrefix.length)
    if (!rel) continue
    const { data, binary } = zipProjectFileEntry(rel, f.content)
    inner.file(rel, data, binary ? { binary: true } : undefined)
  }

  const blob = await inner.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  outer.file(destPath, blob)
}

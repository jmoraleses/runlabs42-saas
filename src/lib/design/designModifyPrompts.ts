import { pageHtmlPath } from '@/lib/design/pages'
import type { DesignPageMeta } from '@/lib/design/types'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'

/** El usuario pide explícitamente crear, cambiar o quitar fotos/imágenes. */
export function userPromptRequestsImageChanges(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  const lower = p.toLowerCase()
  if (/\[image:/i.test(p)) return true
  if (/\bassets\/[\w./-]+\.(jpg|jpeg|png|webp|gif)\b/i.test(p)) return true

  const wantsChange =
    /\b(imagen|imágenes|foto|fotos|fotografía|fotografias|ilustración|ilustracion|banner visual|hero visual)\b/i.test(
      lower,
    )
  const action =
    /\b(añad\w*|agreg\w*|add\w*|crea\w*|gener\w*|cambi\w*|change\w*|sustituy\w*|reemplaz\w*|actualiz\w*|quita\w*|elimin\w*|remov\w*|borr\w*|sin foto|sin imagen|new image|replace image|remove image)\b/i.test(
      lower,
    )
  if (wantsChange && action) return true
  if (/\b(quitar|eliminar|remover)\s+(la\s+)?(imagen|foto)\b/i.test(lower)) return true
  if (/\b(añadir|agregar|add)\s+(una\s+)?(imagen|foto)\b/i.test(lower)) return true
  if (/\b(solo|only)\s+(texto|copy|color|colores|tipograf|fuente|espaciado|padding|margen)\b/i.test(lower)) {
    return false
  }
  return false
}

export function existingPageHtml(
  existing: ProjectFileRecord[] | undefined,
  pageId: string,
): string {
  if (!existing?.length) return ''
  const htmlPath = pageHtmlPath(pageId)
  const byPath = existing.find((f) => f.path === htmlPath)?.content?.trim()
  if (byPath) return byPath
  const page = existing.find(
    (f) => f.path.startsWith(`design/pages/${pageId}/`) && f.path.endsWith('.html'),
  )
  return page?.content?.trim() ?? ''
}

export function pageHasPersistedImageAssets(
  existing: ProjectFileRecord[] | undefined,
  pageId: string,
): boolean {
  if (!existing?.length) return false
  const prefix = `design/pages/${pageId}/assets/`
  return existing.some(
    (f) =>
      f.path.startsWith(prefix) &&
      /\.(jpg|jpeg|png|webp|gif)$/i.test(f.path) &&
      (f.sizeBytes > 0 || Boolean(f.content?.trim()) || Boolean(f.storageKey)),
  )
}

/** Bloque para regenerar una pantalla existente sin destruir fotos ya generadas. */
export function rebuildPageModifyHtmlBlock(
  pageId: string,
  existingHtml: string,
  userPrompt: string,
  opts?: { generateImages?: boolean },
): string {
  if (!existingHtml.trim()) return ''
  const wantsImages = userPromptRequestsImageChanges(userPrompt)
  const preserve =
    !wantsImages && (!opts?.generateImages || pageHasPersistedImageAssetsFromHtml(existingHtml))

  const preserveRule = preserve
    ? `
**CONSERVAR FOTOS EXISTENTES (obligatorio):**
- Mantén INTACTOS todos los \`<img src="assets/...">\` del HTML actual (mismas rutas, data-sk-id y clases object-cover/aspect).
- NO sustituyas fotos por \`<div>\` de gradiente ni placeholders vacíos.
- NO elimines bloques de imagen si el usuario no pidió cambiar fotos.
- Para huecos nuevos sin foto, usa un único \`<div class="rounded-xl aspect-[4/3] bg-gradient-to-br from-primary-container/70 to-secondary-container/50 w-full"></div>\` (sin \`<img>\` hermano).`
    : opts?.generateImages
      ? `
Si el usuario no pidió cambiar imágenes concretas, conserva los \`<img src="assets/...">\` existentes y sus rutas.`
      : `
Sin generación de imágenes: conserva \`<img src="assets/...">\` existentes; solo usa gradientes en huecos nuevos sin asset.`

  const excerpt =
    existingHtml.length > 48_000
      ? `${existingHtml.slice(0, 48_000)}\n\n<!-- … HTML truncado para contexto -->`
      : existingHtml

  return [
    `## Modificación de pantalla existente (\`${pageId}\`)`,
    'Aplica **solo** el cambio pedido por el usuario sobre esta pantalla. Devuelve el HTML **completo** actualizado en la misma ruta.',
    'Conserva estructura, tokens, tipografía, navegación y data-sk-id salvo que el cambio lo requiera.',
    preserveRule,
    `### HTML actual (${pageId})`,
    excerpt,
  ].join('\n\n')
}

function pageHasPersistedImageAssetsFromHtml(html: string): boolean {
  return /<img\b[^>]*\bsrc=["']assets\/[^"']+["']/i.test(html)
}

/** Pins de elemento/área en modificación (misma pantalla, no variante nueva). */
export function orchestrationElementContextsModifyBlock(
  contexts: Array<{ skId: string; tagName: string; text?: string }>,
): string {
  if (!contexts.length) return ''
  if (contexts.length === 1) {
    const c = contexts[0]!
    return (
      `\n## Elemento objetivo (modificación in situ)\n` +
      `<${c.tagName}> data-sk-id="${c.skId}"` +
      (c.text ? ` texto="${c.text}"` : '') +
      '\nAplica el cambio **solo** en ese elemento (y su subtree). No rehagas el resto de la página ni sustituyas otras imágenes.'
    )
  }
  return (
    `\n## Elementos objetivo (modificación in situ)\n` +
    contexts
      .map(
        (c, i) =>
          `${i + 1}. <${c.tagName}> data-sk-id="${c.skId}"` +
          (c.text ? ` texto="${c.text}"` : ''),
      )
      .join('\n') +
    '\nAplica los cambios **solo** en esos elementos. Conserva el resto del HTML y las fotos existentes.'
  )
}

export function shouldPreserveExistingImagesOnModify(opts: {
  userPrompt: string
  generateImages?: boolean
  existingHtml?: string
  page?: Pick<DesignPageMeta, 'id'>
  existingFiles?: ProjectFileRecord[]
}): boolean {
  if (userPromptRequestsImageChanges(opts.userPrompt)) return false
  if (opts.existingHtml && pageHasPersistedImageAssetsFromHtml(opts.existingHtml)) return true
  if (opts.page?.id && pageHasPersistedImageAssets(opts.existingFiles, opts.page.id)) return true
  return !opts.generateImages
}

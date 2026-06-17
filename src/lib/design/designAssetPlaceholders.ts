import {
  expectedDesignPageImagePaths,
  pendingDesignPageImagePaths,
} from '@/lib/design/designImagePaths'
import {
  DESIGN_PLACEHOLDER_JPEG_BASE64,
  DESIGN_PLACEHOLDER_SVG,
} from '@/lib/design/designPlaceholderAssets'
import { isRasterImagePath, isSvgImagePath } from '@/lib/design/previewBinary'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'

/** Rutas de assets ya persistidos (incluye meta sin contenido en memoria). */
export function designAssetReadyPathsFromExisting(
  existing?: ProjectFileRecord[],
): Set<string> {
  const ready = new Set<string>()
  if (!existing?.length) return ready
  for (const f of existing) {
    const path = f.path?.trim()
    if (!path) continue
    if (isRasterImagePath(path) || isSvgImagePath(path) || path.includes('/assets/')) {
      ready.add(path)
    }
  }
  return ready
}

/** No sobrescribir JPEG/PNG en disco con contenido vacío del contexto de generación. */
export function isPersistableDesignFileContent(path: string, content: string): boolean {
  if (isRasterImagePath(path) && !content.trim()) return false
  return true
}

export {
  DESIGN_PLACEHOLDER_JPEG_BASE64,
  DESIGN_PLACEHOLDER_SVG,
  LEGACY_INVALID_PLACEHOLDER_JPEG_BASE64,
} from '@/lib/design/designPlaceholderAssets'

export function buildPlaceholderAssetFilesForHtml(
  htmlFiles: Array<{ path: string; content: string }>,
  existingPaths: Set<string>,
): Array<{ path: string; content: string }> {
  const pending = new Set<string>()
  for (const file of htmlFiles) {
    if (!file.path.endsWith('.html')) continue
    for (const path of pendingDesignPageImagePaths(
      expectedDesignPageImagePaths(file.content, file.path),
      existingPaths,
    )) {
      if (isRasterImagePath(path)) pending.add(path)
      else if (isSvgImagePath(path)) pending.add(path)
    }
  }
  return [...pending].map((path) => ({
    path,
    content: isSvgImagePath(path) ? DESIGN_PLACEHOLDER_SVG : DESIGN_PLACEHOLDER_JPEG_BASE64,
  }))
}

/** Placeholders para imágenes referenciadas en HTML que aún no están en el lote de archivos. */
export function designImagePlaceholdersForFiles(
  files: Array<{ path: string; content: string }>,
  additionalReadyPaths?: Iterable<string>,
): Array<{ path: string; content: string }> {
  const existing = new Set(files.map((f) => f.path))
  if (additionalReadyPaths) {
    for (const path of additionalReadyPaths) existing.add(path)
  }
  return buildPlaceholderAssetFilesForHtml(
    files.filter((f) => f.path.endsWith('.html')),
    existing,
  )
}

export function filterPersistableDesignFiles(
  files: Array<{ path: string; content: string }>,
): Array<{ path: string; content: string }> {
  return files.filter((f) => isPersistableDesignFileContent(f.path, f.content))
}

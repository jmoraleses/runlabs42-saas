import { imageBodyFromStoredContent } from '@/lib/design/previewBinary'
import { isImageWorkspacePath } from '@/lib/projects/workspaceMedia'

const RASTER_IMAGE_RE = /\.(png|jpe?g|gif|webp|ico)$/i

export type ZipProjectFileEntry = {
  data: string | Uint8Array
  binary?: boolean
}

/** Prepara el contenido de un archivo del workspace para JSZip (texto vs binario). */
export function zipProjectFileEntry(path: string, content: string): ZipProjectFileEntry {
  const norm = path.replace(/^\//, '')

  if (RASTER_IMAGE_RE.test(norm) || (isImageWorkspacePath(norm) && !norm.endsWith('.svg'))) {
    const body = imageBodyFromStoredContent(content)
    if (body) {
      return { data: new Uint8Array(body), binary: true }
    }
  }

  return { data: content }
}

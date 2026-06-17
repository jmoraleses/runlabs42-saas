import { isRasterImagePath } from '@/lib/design/previewBinary'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'

const DESIGN_PATH_PREFIXES = ['spec/design', 'design/site', 'design/pages', 'design/mockups'] as const

/** Rutas de diseño previas (sin cargar PNGs enormes en memoria). */
export function isDesignExistingPath(path: string): boolean {
  return DESIGN_PATH_PREFIXES.some((p) => path.startsWith(p))
}

type DesignFilesStore = {
  listMeta?: () => Promise<ProjectFileRecord[]>
  list: () => Promise<ProjectFileRecord[]>
  get: (path: string) => Promise<ProjectFileRecord | null>
}

const PNG_SKIP_BYTES = 512_000

/**
 * Carga archivos de diseño existentes para contexto de generación.
 * Usa listMeta cuando existe para no leer mockups PNG de varios MB con list().
 */
export async function loadExistingDesignFiles(
  store: DesignFilesStore,
): Promise<ProjectFileRecord[]> {
  const meta =
    typeof store.listMeta === 'function' ? await store.listMeta() : await store.list()
  const designMeta = meta.filter((f) => isDesignExistingPath(f.path))
  const out: ProjectFileRecord[] = []

  for (const f of designMeta) {
    if (isRasterImagePath(f.path) && (f.sizeBytes ?? 0) > PNG_SKIP_BYTES) {
      out.push({ ...f, content: '' })
      continue
    }
    const full = await store.get(f.path)
    if (full) out.push(full)
  }

  return out
}

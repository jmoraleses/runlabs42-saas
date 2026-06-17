import { isDesignExistingPath } from '@/lib/storage/loadDesignExistingFiles'

type DesignFilesStore = {
  listMeta?: () => Promise<Array<{ path: string }>>
  list: () => Promise<Array<{ path: string }>>
  delete: (path: string) => Promise<void>
}

/** Elimina todos los archivos de diseño persistidos del proyecto (spec, tokens, HTML, mockups). */
export async function clearPersistedDesignFiles(store: DesignFilesStore): Promise<number> {
  const meta =
    typeof store.listMeta === 'function' ? await store.listMeta() : await store.list()
  const paths = meta.map((f) => f.path).filter(isDesignExistingPath)
  for (const path of paths) {
    await store.delete(path)
  }
  return paths.length
}

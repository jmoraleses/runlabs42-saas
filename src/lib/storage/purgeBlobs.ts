import { del, list } from '@vercel/blob'
import { blobToken, isBlobStorageEnabled } from '@/lib/storage/config'

/** Elimina todos los blobs bajo un prefijo. Devuelve bytes liberados (aprox.). */
export async function purgeBlobPrefix(prefix: string): Promise<number> {
  if (!isBlobStorageEnabled()) return 0
  const token = blobToken()
  let freed = 0
  let cursor: string | undefined
  do {
    const page = await list({ prefix, token, cursor, limit: 100 })
    if (page.blobs.length) {
      await del(page.blobs.map((b) => b.url), { token })
      freed += page.blobs.reduce((n, b) => n + (b.size ?? 0), 0)
    }
    cursor = page.cursor
  } while (cursor)
  return freed
}

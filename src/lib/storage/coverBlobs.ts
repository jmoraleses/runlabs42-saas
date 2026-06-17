import { del, list } from '@vercel/blob'
import { blobToken, isBlobStorageEnabled } from '@/lib/storage/config'
import { projectCoversPrefix } from '@/lib/storage/blobPaths'

export async function deleteProjectCovers(userId: string, projectId: string): Promise<void> {
  if (!isBlobStorageEnabled()) return
  const prefix = projectCoversPrefix(userId, projectId)
  const token = blobToken()
  let cursor: string | undefined
  do {
    const page = await list({ prefix, token, cursor, limit: 100 })
    if (page.blobs.length) {
      await del(page.blobs.map((b) => b.url), { token })
    }
    cursor = page.cursor
  } while (cursor)
}

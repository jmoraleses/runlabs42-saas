export function blobToken(): string | undefined {
  const t = process.env.BLOB_READ_WRITE_TOKEN
  return t && t.trim() ? t : undefined
}

export function blobStoreId(): string | undefined {
  const s = process.env.BLOB_STORE_ID
  return s && s.trim() ? s : undefined
}

/**
 * Devuelve los opts de autenticación para @vercel/blob.
 * - Si hay BLOB_READ_WRITE_TOKEN, lo usa.
 * - Si no, deja que el SDK detecte OIDC automáticamente en Vercel.
 *   (No pasamos `token: ""` porque el SDK lo trata como inválido.)
 */
export function blobAuthOpts(): { token?: string } {
  const t = blobToken()
  return t ? { token: t } : {}
}

export function isBlobStorageEnabled(): boolean {
  return Boolean(blobToken() || blobStoreId())
}

export function userStorageLimitBytes(): number {
  const mb = Number(process.env.USER_STORAGE_LIMIT_MB ?? '100')
  if (!Number.isFinite(mb) || mb <= 0) return 100 * 1024 * 1024
  return Math.floor(mb * 1024 * 1024)
}

export const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024

// When Blob is enabled, all project files go to Blob regardless of size.
// Set to a positive value only if you want small files to stay inline in the DB.
export const INLINE_CONTENT_MAX_BYTES = 0

import { put } from '@vercel/blob'
import { ApiError } from '@/lib/api/errors'
import { designRefBlobPath } from './blobPaths'
import { blobToken, isBlobStorageEnabled } from './config'
import { validateAndSanitizeImage } from './imageValidator'

export type DesignImageRef = {
  id: string
  url: string
  mimeType: string
  name: string
}

function requireBlob() {
  if (!isBlobStorageEnabled()) {
    throw new ApiError(503, 'Almacenamiento no disponible (BLOB_READ_WRITE_TOKEN)')
  }
}

export async function uploadDesignReferenceImage(params: {
  userId: string
  projectId: string
  fileId: string
  buffer: Buffer
  name?: string
}): Promise<DesignImageRef> {
  requireBlob()
  const validated = await validateAndSanitizeImage(params.buffer)
  const pathname = designRefBlobPath(params.userId, params.projectId, params.fileId)

  const blob = await put(pathname, validated.buffer, {
    access: 'public',
    token: blobToken(),
    contentType: validated.mimeType,
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  return {
    id: params.fileId,
    url: blob.url,
    mimeType: validated.mimeType,
    name: params.name ?? params.fileId,
  }
}

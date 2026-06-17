import { del, list, put } from '@vercel/blob'
import { ApiError } from '@/lib/api/errors'
import {
  chatImageBlobPath,
  chatSessionPrefix,
  legacyChatSessionPrefix,
  projectChatPrefix,
} from './blobPaths'
import { blobToken, isBlobStorageEnabled } from './config'
import { validateAndSanitizeImage, type ValidatedImage } from './imageValidator'

export type ChatImageRef = {
  id: string
  url: string
  mimeType: string
  name: string
}

function requireBlob() {
  if (!isBlobStorageEnabled()) {
    throw new ApiError(503, 'Almacenamiento temporal no disponible (BLOB_READ_WRITE_TOKEN)')
  }
}

export async function uploadChatImage(params: {
  userId: string
  projectId: string
  sessionId: string
  fileId: string
  buffer: Buffer
  name?: string
}): Promise<ChatImageRef> {
  requireBlob()
  const validated = await validateAndSanitizeImage(params.buffer)
  const pathname = chatImageBlobPath(
    params.userId,
    params.projectId,
    params.sessionId,
    params.fileId,
  )

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

async function listAndDeletePrefix(prefix: string): Promise<number> {
  let deleted = 0
  let cursor: string | undefined
  do {
    const result = await list({ prefix, token: blobToken(), cursor })
    if (result.blobs.length) {
      await del(
        result.blobs.map((b) => b.url),
        { token: blobToken() },
      )
      deleted += result.blobs.length
    }
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)
  return deleted
}

export async function deleteChatSession(
  userId: string,
  sessionId: string,
  projectId?: string,
): Promise<number> {
  if (!isBlobStorageEnabled()) return 0
  let deleted = 0
  deleted += await listAndDeletePrefix(legacyChatSessionPrefix(userId, sessionId))
  if (projectId) {
    deleted += await listAndDeletePrefix(chatSessionPrefix(userId, projectId, sessionId))
  }
  return deleted
}

export async function deleteAllProjectChatBlobs(
  userId: string,
  projectId: string,
): Promise<number> {
  if (!isBlobStorageEnabled()) return 0
  return listAndDeletePrefix(projectChatPrefix(userId, projectId))
}

async function allowedSessionBlobUrls(
  userId: string,
  sessionId: string,
  projectId?: string,
): Promise<Set<string>> {
  const urls = new Set<string>()
  if (!isBlobStorageEnabled()) return urls
  const prefixes = [legacyChatSessionPrefix(userId, sessionId)]
  if (projectId) prefixes.push(chatSessionPrefix(userId, projectId, sessionId))

  for (const prefix of prefixes) {
    let cursor: string | undefined
    do {
      const result = await list({ prefix, token: blobToken(), cursor })
      for (const b of result.blobs) urls.add(b.url)
      cursor = result.hasMore ? result.cursor : undefined
    } while (cursor)
  }
  return urls
}

export async function fetchChatImageAsBase64(
  url: string,
  userId: string,
  sessionId: string,
  projectId?: string,
): Promise<{ mimeType: string; data: string }> {
  const allowed = await allowedSessionBlobUrls(userId, sessionId, projectId)
  if (!allowed.has(url)) {
    throw new ApiError(403, 'URL de imagen no válida')
  }
  const res = await fetch(url)
  if (!res.ok) throw new ApiError(400, 'No se pudo leer la imagen')
  const buf = Buffer.from(await res.arrayBuffer())
  const validated: ValidatedImage = await validateAndSanitizeImage(buf)
  return {
    mimeType: validated.mimeType,
    data: validated.buffer.toString('base64'),
  }
}

export async function resolveImageRefsForModel(
  refs: { url: string; mimeType?: string }[],
  userId: string,
  sessionId: string,
  projectId?: string,
): Promise<{ mimeType: string; data: string }[]> {
  const allowed = await allowedSessionBlobUrls(userId, sessionId, projectId)
  const out: { mimeType: string; data: string }[] = []
  for (const ref of refs) {
    if (ref.url.startsWith('data:')) {
      const match = ref.url.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        out.push({ mimeType: match[1]!, data: match[2]! })
      }
      continue
    }
    if (!allowed.has(ref.url)) {
      throw new ApiError(403, 'URL de imagen no válida')
    }
    out.push(await fetchChatImageAsBase64(ref.url, userId, sessionId, projectId))
  }
  return out
}

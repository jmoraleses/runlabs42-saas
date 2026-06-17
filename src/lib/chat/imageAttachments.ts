/** Máximo de imágenes por mensaje en el chat (landing + editor). */
export const MAX_CHAT_IMAGES = 5

export type LocalImageAttachment = {
  id: string
  mimeType: string
  dataUrl: string
  name: string
  previewUrl: string
  blobUrl?: string
}

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

function resolveMimeType(file: File): string | null {
  if (ALLOWED.has(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext]
  return null
}

/** Comprueba tipo y que el navegador pueda decodificar la imagen. */
export async function validateImageFile(file: File): Promise<string> {
  const mime = resolveMimeType(file)
  if (!mime) {
    throw new Error('Solo imágenes JPEG, PNG, WebP o GIF')
  }
  if (file.size > MAX_SIZE) throw new Error('Imagen demasiado grande (máx. 5 MB)')

  await new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('El archivo no es una imagen válida'))
    }
    img.src = url
  })

  return mime
}

export async function fileToAttachment(file: File): Promise<LocalImageAttachment> {
  const mimeType = await validateImageFile(file)

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })

  return {
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mimeType,
    dataUrl,
    name: file.name,
    previewUrl: dataUrl,
  }
}

/** En desarrollo las imágenes del chat se guardan solo en el navegador (data URL). */
export function isLocalChatImageStorage(): boolean {
  return process.env.NODE_ENV === 'development'
}

/** Normaliza archivos del portapapeles (capturas suelen venir sin nombre ni MIME). */
export function normalizeClipboardImageFile(file: File): File {
  const type =
    file.type && ALLOWED.has(file.type)
      ? file.type
      : 'image/png'
  const name = file.name?.trim() ? file.name : `capture-${Date.now()}.png`
  if (file.type === type && file.name === name) return file
  return new File([file], name, { type })
}

export async function uploadImageToSession(
  file: File,
  sessionId: string,
  projectId?: string,
): Promise<LocalImageAttachment> {
  await validateImageFile(file)

  const form = new FormData()
  form.append('file', file)
  if (projectId) form.append('projectId', projectId)
  const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/images`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const data = (await res.json().catch(() => ({}))) as {
    image?: { id: string; url: string; mimeType: string; name: string }
    error?: string
  }
  if (!res.ok) {
    const msg = data.error ?? (res.status === 401 ? 'No autorizado' : 'No se pudo subir la imagen')
    throw new Error(msg)
  }

  const img = data.image!
  return {
    id: img.id,
    mimeType: img.mimeType,
    dataUrl: '',
    name: img.name,
    previewUrl: img.url,
    blobUrl: img.url,
  }
}

/**
 * Valida en cliente. En local: data URL en el navegador.
 * En producción con sesión: subida efímera al servidor (Vercel Blob).
 */
export async function addImageAttachment(
  file: File,
  sessionId?: string,
  projectId?: string,
): Promise<LocalImageAttachment> {
  const normalized = normalizeClipboardImageFile(file)
  if (isLocalChatImageStorage() || !sessionId) {
    return fileToAttachment(normalized)
  }
  return uploadImageToSession(normalized, sessionId, projectId)
}

export function attachmentToApiPayload(att: LocalImageAttachment) {
  const base64 = att.dataUrl?.replace(/^data:[^;]+;base64,/, '').trim()
  if (base64) {
    return { mimeType: att.mimeType, data: base64 }
  }
  if (att.blobUrl) {
    return { url: att.blobUrl, mimeType: att.mimeType }
  }
  return { mimeType: att.mimeType, data: '' }
}

export function isImageRefPayload(
  payload: ReturnType<typeof attachmentToApiPayload>,
): payload is { url: string; mimeType: string } {
  return 'url' in payload && typeof (payload as { url?: string }).url === 'string'
}

export type ModelImagePayload =
  | { mimeType: string; data: string }
  | { url: string; mimeType: string }

/** Convierte adjuntos locales a payloads para la API (base64 o URL). */
export function attachmentsToModelPayloads(
  attachments: LocalImageAttachment[],
): ModelImagePayload[] {
  return attachments.map(attachmentToApiPayload)
}

export function modelPayloadsToInlineImages(
  payloads: ModelImagePayload[],
): Array<{ mimeType: string; data?: string; url?: string }> {
  const out: Array<{ mimeType: string; data?: string; url?: string }> = []
  for (const p of payloads) {
    if ('data' in p && p.data) {
      out.push({
        mimeType: p.mimeType,
        data: p.data.replace(/^data:[^;]+;base64,/, ''),
      })
    } else if ('url' in p && p.url) {
      out.push({ mimeType: p.mimeType, url: p.url })
    }
  }
  return out
}

type PasteClipboardImagesOpts = {
  current: LocalImageAttachment[]
  sessionId?: string
  projectId?: string
  maxImagesLabel: string
  invalidImageLabel: string
}

/**
 * Lee imágenes del portapapeles. Devuelve `null` si el evento no trae imágenes
 * (no hace preventDefault). Si hay imágenes, previene el pegado en el textarea.
 */
export async function pasteClipboardImages(
  e: Pick<ClipboardEvent, 'clipboardData' | 'preventDefault'>,
  opts: PasteClipboardImagesOpts,
): Promise<{ added: LocalImageAttachment[]; error: string | null } | null> {
  const items = e.clipboardData?.items
  if (!items) return null
  const imageItems = Array.from(items).filter((i) => i.type.startsWith('image/'))
  if (!imageItems.length) return null
  e.preventDefault()

  const added: LocalImageAttachment[] = []
  let lastError: string | null = null

  for (const item of imageItems) {
    if (opts.current.length + added.length >= MAX_CHAT_IMAGES) {
      lastError = opts.maxImagesLabel.replace('{n}', String(MAX_CHAT_IMAGES))
      break
    }
    const file = item.getAsFile()
    if (!file) continue
    try {
      added.push(
        await addImageAttachment(file, opts.sessionId, opts.projectId),
      )
    } catch (err) {
      lastError =
        err instanceof Error ? err.message : opts.invalidImageLabel
    }
  }

  return { added, error: lastError }
}

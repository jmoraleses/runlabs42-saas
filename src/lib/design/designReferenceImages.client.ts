'use client'

import { isDemoProjectId } from '@/lib/auth/demo'
import {
  attachmentToApiPayload,
  isImageRefPayload,
  type LocalImageAttachment,
} from '@/lib/chat/imageAttachments'

/** Base64 máximo por imagen en el JSON de design/generate (~1,2 MB en body). */
export const DESIGN_REFERENCE_MAX_INLINE_BASE64 = 900_000

/** Tamaño máximo por imagen al guardar en sessionStorage (landing → Studio). */
export const DESIGN_REFERENCE_MAX_PENDING_DATAURL = 400_000

export type DesignGenerateImagePayload = {
  mimeType: string
  data?: string
  url?: string
}

export function isResolvableDesignImagePayload(
  payload: DesignGenerateImagePayload,
): boolean {
  if (typeof payload.url === 'string' && payload.url.trim()) return true
  const data = payload.data?.replace(/^data:[^;]+;base64,/, '').trim() ?? ''
  return data.length > 64
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen'))
    img.src = src
  })
}

/** Reduce capturas grandes para que entren en el POST y en sessionStorage. */
export async function compressDataUrlForDesignReference(
  dataUrl: string,
  mimeType: string,
  maxBase64Len = DESIGN_REFERENCE_MAX_INLINE_BASE64,
): Promise<{ dataUrl: string; mimeType: string }> {
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '').trim()
  if (!base64 || base64.length <= maxBase64Len) {
    return { dataUrl, mimeType }
  }

  const img = await loadImageElement(dataUrl)
  const canvas = document.createElement('canvas')
  let width = img.naturalWidth
  let height = img.naturalHeight
  const maxDim = 1920
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const draw = (w: number, h: number, quality: number) => {
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  }

  let quality = 0.88
  let out = draw(width, height, quality)
  let outLen = out.replace(/^data:[^;]+;base64,/, '').length
  while (outLen > maxBase64Len && quality > 0.5) {
    quality -= 0.12
    out = draw(width, height, quality)
    outLen = out.replace(/^data:[^;]+;base64,/, '').length
  }
  while (outLen > maxBase64Len && Math.max(width, height) > 720) {
    width = Math.round(width * 0.85)
    height = Math.round(height * 0.85)
    out = draw(width, height, quality)
    outLen = out.replace(/^data:[^;]+;base64,/, '').length
  }

  return { dataUrl: out, mimeType: 'image/jpeg' }
}

export async function compressAttachmentForDesignReference(
  att: LocalImageAttachment,
  maxBase64Len = DESIGN_REFERENCE_MAX_INLINE_BASE64,
): Promise<LocalImageAttachment> {
  if (att.blobUrl?.trim() && !att.dataUrl?.trim()) return att
  if (!att.dataUrl?.trim()) return att
  const { dataUrl, mimeType } = await compressDataUrlForDesignReference(
    att.dataUrl,
    att.mimeType,
    maxBase64Len,
  )
  return {
    ...att,
    mimeType,
    dataUrl,
    previewUrl: dataUrl,
  }
}

async function uploadDesignReferenceToProject(
  file: File,
  projectId: string,
): Promise<{ mimeType: string; url: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/design/images`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const data = (await res.json().catch(() => ({}))) as {
    image?: { blobUrl?: string; mimeType?: string }
    error?: string
  }
  if (!res.ok) {
    throw new Error(data.error ?? 'No se pudo subir la imagen de referencia')
  }
  const url = data.image?.blobUrl?.trim()
  const mimeType = data.image?.mimeType?.trim() || file.type || 'image/png'
  if (!url) throw new Error('Respuesta de subida sin URL')
  return { mimeType, url }
}

function dataUrlToFile(dataUrl: string, mimeType: string, name: string): File {
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: mimeType })
}

function payloadFromAttachment(att: LocalImageAttachment): DesignGenerateImagePayload | null {
  const raw = attachmentToApiPayload(att)
  if (isImageRefPayload(raw)) {
    return { mimeType: raw.mimeType, url: raw.url }
  }
  const data = raw.data?.replace(/^data:[^;]+;base64,/, '').trim()
  if (!data) return null
  return { mimeType: raw.mimeType, data }
}

/**
 * Prepara adjuntos para design/generate: comprime si hace falta y, en proyectos reales,
 * intenta subir a Blob para no saturar el body JSON.
 */
export async function prepareDesignReferencePayloads(
  attachments: LocalImageAttachment[],
  opts?: { projectId?: string },
): Promise<DesignGenerateImagePayload[]> {
  const projectId = opts?.projectId?.trim()
  const canUpload = Boolean(projectId && !isDemoProjectId(projectId))
  const out: DesignGenerateImagePayload[] = []

  for (const att of attachments) {
    let working = await compressAttachmentForDesignReference(att)
    const inline = payloadFromAttachment(working)
    if (!inline) continue

    if (inline.url) {
      out.push(inline)
      continue
    }

    const dataLen = inline.data?.length ?? 0
    if (canUpload && dataLen > DESIGN_REFERENCE_MAX_INLINE_BASE64 * 0.75) {
      try {
        const file = dataUrlToFile(
          working.dataUrl,
          working.mimeType,
          working.name || 'reference.jpg',
        )
        const uploaded = await uploadDesignReferenceToProject(file, projectId!)
        out.push(uploaded)
        continue
      } catch {
        working = await compressAttachmentForDesignReference(
          working,
          DESIGN_REFERENCE_MAX_INLINE_BASE64,
        )
      }
    }

    const compressed = payloadFromAttachment(working)
    if (compressed && isResolvableDesignImagePayload(compressed)) {
      out.push(compressed)
    }
  }

  return out
}

/** Comprime adjuntos antes de guardarlos en sessionStorage (landing → Studio). */
export async function shrinkAttachmentsForPendingSession(
  attachments: LocalImageAttachment[],
): Promise<LocalImageAttachment[]> {
  return Promise.all(
    attachments.map((att) =>
      compressAttachmentForDesignReference(att, DESIGN_REFERENCE_MAX_PENDING_DATAURL),
    ),
  )
}

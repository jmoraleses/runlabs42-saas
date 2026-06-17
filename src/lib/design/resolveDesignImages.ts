import 'server-only'

import type { VertexImagePart } from '@/lib/ai/vertexAgentPlatform'
import { fetchImageAsVertexPart } from '@/lib/design/visualReference'
import { MAX_CHAT_IMAGES } from '@/lib/chat/imageAttachments'

type BodyImage = {
  mimeType?: string
  data?: string
  url?: string
}

/** Resuelve imágenes del body (base64 o URL de sesión) para Vertex multimodal. */
export async function resolveDesignImagesFromBody(
  body: Record<string, unknown>,
): Promise<VertexImagePart[]> {
  const raw = Array.isArray(body.images) ? (body.images as BodyImage[]) : []
  const parts: VertexImagePart[] = []

  for (const x of raw.slice(0, MAX_CHAT_IMAGES)) {
    if (!x || typeof x !== 'object') continue
    const mimeType = String(x.mimeType ?? 'image/png')
    const dataRaw = typeof x.data === 'string' ? x.data.replace(/^data:[^;]+;base64,/, '').trim() : ''
    if (dataRaw.length > 64) {
      parts.push({ mimeType, data: dataRaw })
      continue
    }
    if (typeof x.url === 'string' && x.url.trim()) {
      const fetched = await fetchImageAsVertexPart(x.url.trim())
      if (fetched) parts.push(fetched)
      else {
        console.warn(
          '[resolveDesignImages] No se pudo resolver imagen por URL:',
          x.url.slice(0, 120),
        )
      }
    }
  }

  return parts
}

/** @deprecated Usar resolveDesignImagesFromBody (soporta URL). */
export function parseInlineImagesFromBody(body: Record<string, unknown>): VertexImagePart[] {
  const raw = Array.isArray(body.images) ? body.images : []
  return raw
    .filter(
      (x): x is { mimeType: string; data: string } =>
        Boolean(x && typeof x === 'object' && 'mimeType' in x && 'data' in x),
    )
    .map((x) => ({
      mimeType: String(x.mimeType),
      data: String(x.data).replace(/^data:[^;]+;base64,/, ''),
    }))
    .slice(0, MAX_CHAT_IMAGES)
}

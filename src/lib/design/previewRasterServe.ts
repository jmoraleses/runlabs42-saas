import 'server-only'

import sharp from 'sharp'
import {
  DESIGN_PLACEHOLDER_JPEG_BASE64,
  LEGACY_INVALID_PLACEHOLDER_JPEG_BASE64,
} from '@/lib/design/designPlaceholderAssets'
import { picsumPhotoUrlForDesignAsset } from '@/lib/design/previewPicsum'
import { imageBodyFromStoredContent } from '@/lib/design/previewBinary'

let cachedPlaceholderJpegBuf: Buffer | null = null
const picsumCache = new Map<string, Buffer>()

export function designPlaceholderJpegBuffer(): Buffer {
  if (!cachedPlaceholderJpegBuf) {
    cachedPlaceholderJpegBuf =
      imageBodyFromStoredContent(DESIGN_PLACEHOLDER_JPEG_BASE64) ?? Buffer.alloc(0)
  }
  return cachedPlaceholderJpegBuf
}

export function isPlaceholderRasterContent(content: string): boolean {
  const trimmed = content.trim()
  if (
    trimmed === LEGACY_INVALID_PLACEHOLDER_JPEG_BASE64 ||
    trimmed === DESIGN_PLACEHOLDER_JPEG_BASE64
  ) {
    return true
  }
  const buf = imageBodyFromStoredContent(content)
  if (!buf?.length) return false
  const ph = designPlaceholderJpegBuffer()
  return buf.length === ph.length && buf.equals(ph)
}

async function fetchPicsumPreview(filePath: string): Promise<Buffer | null> {
  const cached = picsumCache.get(filePath)
  if (cached) return cached

  const url = picsumPhotoUrlForDesignAsset(filePath)
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: 'image/*' },
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 200) return null
    try {
      const meta = await sharp(buf).metadata()
      if (!meta.width || !meta.height) return null
    } catch {
      return null
    }
    if (picsumCache.size > 64) picsumCache.clear()
    picsumCache.set(filePath, buf)
    return buf
  } catch {
    return null
  }
}

function previewUsesPicsumPlaceholders(): boolean {
  return process.env.DESIGN_PREVIEW_USE_PICSUM === '1'
}

/** Sirve JPEG válido; placeholders neutros hasta generación real (sin fotos Picsum aleatorias). */
export async function rasterPreviewBody(content: string, filePath: string): Promise<Buffer> {
  if (isPlaceholderRasterContent(content)) {
    if (previewUsesPicsumPlaceholders()) {
      const picsum = await fetchPicsumPreview(filePath)
      if (picsum) return picsum
    }
    return designPlaceholderJpegBuffer()
  }
  const buf = imageBodyFromStoredContent(content)
  if (!buf) return designPlaceholderJpegBuffer()
  try {
    const meta = await sharp(buf).metadata()
    if (meta.width && meta.height && meta.width > 0 && meta.height > 0) return buf
  } catch {
    /* corrupto */
  }
  if (previewUsesPicsumPlaceholders()) {
    const picsum = await fetchPicsumPreview(filePath)
    if (picsum) return picsum
  }
  return designPlaceholderJpegBuffer()
}

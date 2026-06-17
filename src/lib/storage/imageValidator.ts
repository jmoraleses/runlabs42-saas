import { fileTypeFromBuffer } from 'file-type'
import sharp from 'sharp'
import { ApiError } from '@/lib/api/errors'
import { MAX_CHAT_IMAGE_BYTES } from './config'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type ValidatedImage = {
  buffer: Buffer
  mimeType: string
  sizeBytes: number
}

export async function validateAndSanitizeImage(
  input: Buffer,
  maxBytes = MAX_CHAT_IMAGE_BYTES,
): Promise<ValidatedImage> {
  if (input.length > maxBytes) {
    throw new ApiError(400, 'Imagen demasiado grande (máx. 5 MB)')
  }

  const detected = await fileTypeFromBuffer(input)
  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    throw new ApiError(400, 'Solo imágenes JPEG, PNG, WebP o GIF')
  }

  let pipeline = sharp(input, { failOn: 'error' }).rotate()

  if (detected.mime === 'image/jpeg') {
    pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true })
  } else if (detected.mime === 'image/png') {
    pipeline = pipeline.png({ compressionLevel: 9 })
  } else if (detected.mime === 'image/webp') {
    pipeline = pipeline.webp({ quality: 85 })
  } else if (detected.mime === 'image/gif') {
    pipeline = pipeline.gif()
  }

  const buffer = await pipeline.toBuffer()
  if (buffer.length > maxBytes) {
    throw new ApiError(400, 'Imagen demasiado grande tras procesar')
  }

  return {
    buffer,
    mimeType: detected.mime,
    sizeBytes: buffer.length,
  }
}

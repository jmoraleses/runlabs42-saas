import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** JPEG placeholder corrupto (histórico); sustituir al servir o persistir. */
export const LEGACY_INVALID_PLACEHOLDER_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAVAAEAAAAAAAAAAAAAAAAAAAAA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k='

let cachedPlaceholderJpegBase64: string | null = null

/** JPEG 640×480 válido para preview y placeholders en disco. */
export function getDesignPlaceholderJpegBase64(): string {
  if (cachedPlaceholderJpegBase64) return cachedPlaceholderJpegBase64
  cachedPlaceholderJpegBase64 = readFileSync(
    join(process.cwd(), 'src/lib/design/assets/placeholder-raster.jpg'),
  ).toString('base64')
  return cachedPlaceholderJpegBase64
}

export const DESIGN_PLACEHOLDER_JPEG_BASE64 = getDesignPlaceholderJpegBase64()

export const DESIGN_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="40" viewBox="0 0 128 40" role="img" aria-hidden="true"><rect width="128" height="40" rx="6" fill="#e5e2dd"/><text x="64" y="24" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#737973">Logo</text></svg>`

/** Convierte contenido guardado (base64 o data URL) en buffer para servir imágenes. */
export function imageBodyFromStoredContent(content: string): Buffer | null {
  const trimmed = content.trim()
  if (!trimmed) return null

  const base64 = trimmed.startsWith('data:')
    ? trimmed.replace(/^data:[^;]+;base64,/, '')
    : trimmed

  const sample = base64.replace(/\s/g, '').slice(0, 80)
  if (!sample || !/^[A-Za-z0-9+/=]+$/.test(sample)) return null

  try {
    const buf = Buffer.from(base64.replace(/\s/g, ''), 'base64')
    return buf.length > 0 ? buf : null
  } catch {
    return null
  }
}

export function isRasterImagePath(filePath: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(filePath)
}

export function isSvgImagePath(filePath: string): boolean {
  return /\.svg$/i.test(filePath)
}

export function decodeDesignBinary(content: string): { body: Buffer; mimeType: string } {
  const buf = imageBodyFromStoredContent(content)
  if (!buf) throw new Error('Contenido de imagen inválido')
  const trimmed = content.trim()
  const mimeMatch = trimmed.match(/^data:([^;]+);base64,/)
  const mimeType = mimeMatch?.[1] ?? 'image/png'
  return { body: buf, mimeType }
}

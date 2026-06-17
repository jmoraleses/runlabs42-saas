/** Añade texto dictado al contenido existente con separación natural. */
export function appendTranscript(current: string, chunk: string): string {
  const trimmed = chunk.trim()
  if (!trimmed) return current
  if (!current.trim()) return trimmed
  const needsSpace = !current.endsWith(' ') && !current.endsWith('\n')
  return needsSpace ? `${current} ${trimmed}` : `${current}${trimmed}`
}

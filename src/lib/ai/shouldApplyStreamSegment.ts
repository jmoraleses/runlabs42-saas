/**
 * Preview en vivo durante el stream: no pisar un archivo existente con un bloque aún abierto.
 * La persistencia al cerrar el fence usa `applyStreamFiles` con el bloque `complete: true`.
 */
export function shouldApplyStreamSegment(
  segment: { complete: boolean; content: string },
  existing?: { content: string } | null,
): boolean {
  if (!segment.content.trim() && !existing?.content?.trim()) return false
  if (!segment.complete && existing?.content?.trim()) return false
  return true
}

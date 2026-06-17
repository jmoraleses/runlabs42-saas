import type { VisualPatch } from './protocol'
import { ELEMENT_MAP } from './element-map'

/**
 * Aplica un parche visual al código fuente (heurístico, sin AST).
 */
export function applyVisualPatch(
  code: string,
  patch: VisualPatch,
  options?: { previousText?: string },
): { code: string; applied: boolean } {
  const entry = ELEMENT_MAP[patch.skId]
  if (!entry) {
    return { code, applied: false }
  }

  if (patch.property === 'text') {
    const prev = options?.previousText?.trim()
    if (prev && code.includes(prev)) {
      return { code: code.replace(prev, patch.value), applied: true }
    }
    if (entry.search && !entry.search.startsWith('{') && code.includes(entry.search)) {
      return { code: code.replace(entry.search, patch.value), applied: true }
    }
    if (entry.previewLiteral && code.includes(entry.previewLiteral)) {
      return { code: code.replace(entry.previewLiteral, patch.value), applied: true }
    }
    return { code, applied: false }
  }

  if (patch.property === 'className' && entry.classNamePattern) {
    if (entry.classNamePattern.test(code)) {
      const next = code.replace(entry.classNamePattern, `className={\`${patch.value}\`}`)
      return { code: next, applied: next !== code }
    }
  }

  return { code, applied: false }
}

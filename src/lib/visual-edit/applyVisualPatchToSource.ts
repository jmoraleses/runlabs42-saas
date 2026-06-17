import { applyVisualPatch } from '@/lib/visual-edit/applyVisualPatch'
import type { VisualPatch } from '@/lib/visual-edit/protocol'

type ElementHint = {
  skId: string
  tagName: string
  text?: string
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Aplica parche visual al código fuente (mapa demo + heurísticas por sk-id/texto). */
export function applyVisualPatchToSource(
  code: string,
  patch: VisualPatch,
  element: ElementHint,
  options?: { previousText?: string },
): { code: string; applied: boolean } {
  const legacy = applyVisualPatch(code, patch, { previousText: options?.previousText ?? element.text })
  if (legacy.applied) return legacy

  if (patch.property !== 'text') return { code, applied: false }

  const prev = (options?.previousText ?? element.text)?.trim()
  if (prev && code.includes(prev)) {
    const idx = code.indexOf(prev)
    return {
      code: code.slice(0, idx) + patch.value + code.slice(idx + prev.length),
      applied: true,
    }
  }

  const sk = escapeRe(patch.skId)
  const tag = element.tagName.toLowerCase()

  if (tag === 'input' || tag === 'textarea') {
    const inputRe = new RegExp(`<${tag}([^>]*data-sk-id=["']${sk}["'][^>]*)>`, 'i')
    const m = code.match(inputRe)
    if (m?.[0]) {
      let attrs = m[1] ?? ''
      if (/value=["'][^"']*["']/i.test(attrs)) {
        attrs = attrs.replace(/value=["'][^"']*["']/i, `value="${patch.value}"`)
      } else {
        attrs += ` value="${patch.value}"`
      }
      const next = code.replace(inputRe, `<${tag}${attrs}>`)
      return { code: next, applied: next !== code }
    }
  }

  const blockRe = new RegExp(
    `<([a-z][a-z0-9]*)[^>]*data-sk-id=["']${sk}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i',
  )
  const m = code.match(blockRe)
  if (m?.[0]) {
    const full = m[0]
    const openEnd = full.indexOf('>') + 1
    const closeStart = full.lastIndexOf('<')
    const next = full.slice(0, openEnd) + patch.value + full.slice(closeStart)
    return { code: code.replace(full, next), applied: true }
  }

  return { code, applied: false }
}

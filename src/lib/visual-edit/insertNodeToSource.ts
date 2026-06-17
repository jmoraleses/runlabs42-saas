import type { ElementDescriptor, InsertNodeKind, InsertNodePayload } from '@/lib/visual-edit/protocol'

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function snippetForKind(payload: InsertNodePayload): string {
  const sk = payload.skId
  const text = payload.text ?? defaultText(payload.kind)
  switch (payload.kind) {
    case 'heading':
      return `<h2 data-sk-id="${sk}">${text}</h2>`
    case 'image':
      return `<img data-sk-id="${sk}" src="${payload.src ?? 'https://placehold.co/400x240'}" alt="" />`
    case 'button':
      return `<button type="button" data-sk-id="${sk}">${text}</button>`
    case 'section':
      return `<div data-sk-id="${sk}" style={{ minHeight: '48px', padding: '12px' }}></div>`
    case 'text':
    default:
      return `<p data-sk-id="${sk}">${text}</p>`
  }
}

function defaultText(kind: InsertNodeKind): string {
  switch (kind) {
    case 'heading':
      return 'Nuevo título'
    case 'button':
      return 'Botón'
    case 'section':
      return ''
    default:
      return 'Nuevo texto'
  }
}

/** Inserta un nodo JSX con data-sk-id en el código fuente del archivo activo. */
export function insertNodeToSource(
  code: string,
  payload: InsertNodePayload,
  element: ElementDescriptor,
): { code: string; applied: boolean } {
  const snippet = snippetForKind(payload)
  const sk = escapeRe(payload.skId)
  const parentSk = payload.parentSkId ? escapeRe(payload.parentSkId) : ''

  if (parentSk) {
    const parentRe = new RegExp(
      `<([a-z][a-z0-9]*)[^>]*data-sk-id=["']${parentSk}["'][^>]*>`,
      'i',
    )
    const m = code.match(parentRe)
    if (m?.index !== undefined) {
      const openTag = m[0]
      const insertAt = m.index + openTag.length
      const next = code.slice(0, insertAt) + '\n        ' + snippet + code.slice(insertAt)
      return { code: next, applied: next !== code }
    }
  }

  const selfRe = new RegExp(`<([a-z][a-z0-9]*)[^>]*data-sk-id=["']${sk}["'][^>]*>`, 'i')
  if (selfRe.test(code)) return { code, applied: true }

  const returnMain = code.match(/return\s*\(\s*([\s\S]*?)\n\s*\)/)
  if (returnMain?.[1]) {
    const inner = returnMain[1]
    const mainClose = inner.lastIndexOf('</main>')
    if (mainClose !== -1) {
      const abs = code.indexOf(returnMain[0]) + returnMain[0].indexOf(inner) + mainClose
      const next = code.slice(0, abs) + '\n        ' + snippet + code.slice(abs)
      return { code: next, applied: next !== code }
    }
    const lastClose = inner.lastIndexOf('</')
    if (lastClose !== -1) {
      const abs = code.indexOf(returnMain[0]) + returnMain[0].indexOf(inner) + lastClose
      const next = code.slice(0, abs) + '\n        ' + snippet + '\n        ' + code.slice(abs)
      return { code: next, applied: next !== code }
    }
  }

  if (code.includes('</body>')) {
    const next = code.replace('</body>', `  ${snippet}\n</body>`)
    return { code: next, applied: next !== code }
  }

  const tag = element.tagName.toLowerCase()
  if (tag && code.includes(`<${tag}`)) {
    const blockRe = new RegExp(`(<${tag}[^>]*>[\\s\\S]*?</${tag}>)`, 'i')
    const m = code.match(blockRe)
    if (m?.[0]) {
      const next = code.replace(m[0], m[0] + '\n' + snippet)
      return { code: next, applied: next !== code }
    }
  }

  return { code: code.trimEnd() + '\n' + snippet + '\n', applied: true }
}

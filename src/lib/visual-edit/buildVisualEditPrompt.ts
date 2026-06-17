import { ELEMENT_MAP } from '@/lib/visual-edit/element-map'
import type { ElementDescriptor } from '@/lib/visual-edit/protocol'

export function sourceFileForElement(element: ElementDescriptor): string | null {
  if (element.source?.file) return element.source.file
  return ELEMENT_MAP[element.skId]?.file ?? null
}

/** Prompt para el chat de IA con contexto del elemento seleccionado en el preview. */
export function buildVisualEditPrompt(element: ElementDescriptor, userPrompt: string): string {
  const lines = [
    'Modifica el código del proyecto para aplicar este cambio visual.',
    '',
    '## Elemento seleccionado en el preview',
    `- id (data-sk-id): ${element.skId}`,
    `- etiqueta HTML: <${element.tagName}>`,
  ]

  const file = sourceFileForElement(element)
  if (file) {
    const loc =
      element.source?.line != null ? `${file}:${element.source.line}` : file
    lines.push(`- archivo objetivo: ${loc}`)
  }

  if (element.text?.trim()) {
    lines.push(`- texto visible actual: "${element.text.trim().replace(/"/g, '\\"')}"`)
  }

  const styleKeys = [
    'color',
    'backgroundColor',
    'fontSize',
    'fontWeight',
    'textAlign',
    'className',
    'padding',
    'margin',
  ] as const
  const styleParts = styleKeys
    .filter((k) => element.styles[k])
    .map((k) => `${k}=${element.styles[k]}`)
  if (styleParts.length) {
    lines.push(`- estilos actuales: ${styleParts.join(', ')}`)
  }

  lines.push(
    '',
    '## Pedido',
    userPrompt.trim(),
    '',
    'Instrucciones:',
    '- Cambia solo lo necesario para este elemento; conserva el resto de la app.',
    '- Busca en el código el nodo con data-sk-id o el texto/estructura indicados.',
    '- Devuelve los archivos modificados en bloques markdown con la ruta en la primera línea del fence.',
  )

  return lines.join('\n')
}

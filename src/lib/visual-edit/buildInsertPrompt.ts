import { ELEMENT_MAP } from '@/lib/visual-edit/element-map'
import type { ElementDescriptor, InsertNodeKind, InsertPlacementContext } from '@/lib/visual-edit/protocol'

const KIND_LABELS: Record<InsertNodeKind, string> = {
  text: 'párrafo de texto',
  heading: 'título (heading)',
  image: 'imagen',
  button: 'botón',
  section: 'sección / contenedor',
}

export function sourceFileForParent(parentSkId: string, parentElement?: ElementDescriptor): string | null {
  if (parentElement?.source?.file) return parentElement.source.file
  return ELEMENT_MAP[parentSkId]?.file ?? null
}

/** Prompt para que la IA inserte el nodo en el lugar exacto del drop. */
export function buildInsertPrompt(
  placement: InsertPlacementContext,
  created: ElementDescriptor,
  parentElement?: ElementDescriptor,
): string {
  const file =
    sourceFileForParent(placement.parentSkId, parentElement) ??
    created.source?.file ??
    null
  const kindLabel = KIND_LABELS[placement.kind] ?? placement.kind

  const lines = [
    'Inserta en el código fuente del proyecto el siguiente elemento en la posición exacta indicada por el usuario en el preview.',
    '',
    '## Elemento a crear',
    `- tipo: ${kindLabel}`,
    `- id (data-sk-id): ${placement.skId}`,
    `- etiqueta HTML prevista: <${created.tagName}>`,
  ]

  if (file) {
    const loc =
      parentElement?.source?.line != null ? `${file}:${parentElement.source.line}` : file
    lines.push(`- archivo objetivo: ${loc}`)
  }

  lines.push(
    '',
    '## Contenedor padre (donde soltar)',
    `- id del padre (data-sk-id): ${placement.parentSkId}`,
    `- etiqueta del padre: <${placement.parentTag}>`,
  )

  if (placement.insertBeforeSkId) {
    lines.push(`- insertar ANTES del hermano con data-sk-id: ${placement.insertBeforeSkId}`)
  } else if (placement.siblingIndex != null && placement.siblingIndex >= 0) {
    lines.push(`- insertar como hijo nº ${placement.siblingIndex} (0 = primero)`)
  } else {
    lines.push('- insertar al final de los hijos del padre')
  }

  if (placement.dropXPercent != null && placement.dropYPercent != null) {
    lines.push(
      `- posición aproximada del cursor en el padre: ${placement.dropXPercent}% horizontal, ${placement.dropYPercent}% vertical`,
    )
  }

  if (created.text?.trim()) {
    lines.push(`- texto placeholder en preview: "${created.text.trim().replace(/"/g, '\\"')}"`)
  }

  lines.push(
    '',
    '## Instrucciones',
    '- Genera JSX/HTML válido con `data-sk-id="' + placement.skId + '"` en el nodo nuevo.',
    '- Colócalo dentro del padre indicado, respetando el orden respecto a hermanos (insertBefore).',
    '- Usa Tailwind o estilos coherentes con el resto de la página si aplica.',
    '- No elimines ni muevas otros elementos salvo lo necesario para encajar el nuevo.',
    '- Devuelve los archivos modificados en bloques markdown con la ruta en la primera línea del fence.',
  )

  return lines.join('\n')
}

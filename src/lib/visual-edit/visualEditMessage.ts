import { buildVisualEditPrompt, sourceFileForElement } from '@/lib/visual-edit/buildVisualEditPrompt'
import { buildInsertPrompt, sourceFileForParent } from '@/lib/visual-edit/buildInsertPrompt'
import type {
  ElementDescriptor,
  InsertNodeKind,
  InsertPlacementContext,
} from '@/lib/visual-edit/protocol'

export type VisualEditMessageMeta = {
  userPrompt: string
  elementTag: string
  elementId: string
  sourceFile?: string | null
  insertKind?: InsertNodeKind
  parentId?: string
}

/** Prompt completo para la API + metadatos para mostrar en el chat. */
export function buildVisualEditMessage(
  element: ElementDescriptor,
  userPrompt: string,
): { content: string; visualEdit: VisualEditMessageMeta } {
  const trimmed = userPrompt.trim()
  return {
    content: buildVisualEditPrompt(element, trimmed),
    visualEdit: {
      userPrompt: trimmed,
      elementTag: element.tagName,
      elementId: element.skId,
      sourceFile: sourceFileForElement(element),
    },
  }
}

/** Prompt + metadatos para inserción por arrastre en el preview. */
export function buildInsertMessage(
  placement: InsertPlacementContext,
  created: ElementDescriptor,
  parentElement?: ElementDescriptor,
): { content: string; visualEdit: VisualEditMessageMeta } {
  const file = sourceFileForParent(placement.parentSkId, parentElement) ?? sourceFileForElement(created)
  const kindLabels: Record<InsertNodeKind, string> = {
    text: 'texto',
    heading: 'título',
    image: 'imagen',
    button: 'botón',
    section: 'sección',
  }
  const short = `Insertar ${kindLabels[placement.kind] ?? placement.kind} en <${placement.parentTag}>`
  return {
    content: buildInsertPrompt(placement, created, parentElement),
    visualEdit: {
      userPrompt: short,
      elementTag: created.tagName,
      elementId: placement.skId,
      sourceFile: file,
      insertKind: placement.kind,
      parentId: placement.parentSkId,
    },
  }
}

/** Inserción con descripción libre del usuario (flujo + en la barra). */
export function buildInsertMessageWithUserPrompt(
  placement: InsertPlacementContext,
  created: ElementDescriptor,
  userPrompt: string,
  parentElement?: ElementDescriptor,
): { content: string; visualEdit: VisualEditMessageMeta } {
  const trimmed = userPrompt.trim()
  const file = sourceFileForParent(placement.parentSkId, parentElement) ?? sourceFileForElement(created)
  const content = `${buildInsertPrompt(placement, created, parentElement)}\n\n## Descripción del usuario\n${trimmed}`
  const short =
    trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed || `Insertar en <${placement.parentTag}>`
  return {
    content,
    visualEdit: {
      userPrompt: short,
      elementTag: created.tagName,
      elementId: placement.skId,
      sourceFile: file,
      insertKind: placement.kind,
      parentId: placement.parentSkId,
    },
  }
}

/** Extrae metadatos de mensajes antiguos con el prompt largo. */
export function parseVisualEditFromContent(content: string): VisualEditMessageMeta | null {
  if (!content.includes('## Elemento seleccionado en el preview')) return null

  const idMatch = content.match(/id \(data-sk-id\):\s*([^\n]+)/)
  const tagMatch = content.match(/etiqueta HTML:\s*<([^>]+)>/)
  const fileMatch = content.match(/archivo objetivo:\s*([^\n]+)/)
  const pedidoMatch = content.match(/## Pedido\n([\s\S]*?)\n\nInstrucciones:/)

  if (!pedidoMatch) return null

  return {
    userPrompt: (pedidoMatch[1] ?? '').trim(),
    elementId: idMatch?.[1]?.trim() ?? '?',
    elementTag: tagMatch?.[1]?.trim() ?? 'element',
    sourceFile: fileMatch?.[1]?.trim() ?? null,
  }
}

import type { ElementDescriptor } from '@/lib/visual-edit/protocol'
import { canvasPrimaryPageId } from '@/lib/design/types'

export type DesignElementContextPin = {
  skId: string
  tagName: string
  text?: string
  pageId: string
  pageName: string
  /** Etiqueta corta en el chat (p. ej. select1, select2). */
  label?: string
  /** Rectángulo del elemento en coords del iframe (para contorno en el lienzo). */
  rect?: ElementDescriptor['rect']
  /** Instrucciones de cambio (ventana flotante del lápiz). */
  description?: string
}

/** Pantalla completa seleccionada con la flecha (marcador del chat: page1, page2, …). */
export type DesignPageContextPin = {
  pageId: string
  pageName: string
  /** Etiqueta corta en el chat (p. ej. page1, page2). */
  label?: string
}

export function normalizePageDisplayName(name: string): string {
  return name.replace(/^☑\s*/, '').trim()
}

export function pagePinKey(pin: DesignPageContextPin): string {
  return pin.pageId
}

export function nextPagePinLabel(pins: DesignPageContextPin[]): string {
  return `page${pins.length + 1}`
}

/** Marcadores de chat (page1, page2…) a partir de la selección ☑ en el lienzo. */
export function pagePinsFromSelectedPageIds(
  selectedPageIds: Iterable<string>,
  pages: ReadonlyArray<{ id: string; name?: string }>,
): DesignPageContextPin[] {
  const ids = [...selectedPageIds]
    .map((id) => canvasPrimaryPageId(id.trim()))
    .filter(Boolean)
  return ids.map((pageId, index) => {
    const page = pages.find((p) => canvasPrimaryPageId(p.id) === pageId)
    return {
      pageId,
      pageName: normalizePageDisplayName(page?.name ?? pageId),
      label: `page${index + 1}`,
    }
  })
}

export function pageContextMarkerLabel(pin: DesignPageContextPin): string {
  if (pin.label?.trim()) return pin.label.trim()
  const name = normalizePageDisplayName(pin.pageName)
  return name.length > 40 ? `${name.slice(0, 37)}…` : name
}

export function pageContextMarkerDetail(pin: DesignPageContextPin): string {
  const name = normalizePageDisplayName(pin.pageName)
  return `${pageContextMarkerLabel(pin)} — ${name}`
}

export function pageContextPromptSuffix(pin: DesignPageContextPin): string {
  const heading = pin.label ?? 'page1'
  const name = normalizePageDisplayName(pin.pageName)
  return (
    `\n\n## Pantalla objetivo (${heading})\n` +
    `Regenera o modifica **solo** la pantalla «${name}» (id: \`${pin.pageId}\`). ` +
    `No crees pantallas nuevas ni cambies otras pantallas del lienzo.\n`
  )
}

export function pagePinsPromptSuffix(pins: DesignPageContextPin[]): string {
  if (!pins.length) return ''
  if (pins.length === 1) return pageContextPromptSuffix(pins[0]!)
  return (
    `\n\n## Pantallas objetivo (${pins.length})\n` +
    pins
      .map((pin) => {
        const heading = pin.label ?? 'page1'
        const name = normalizePageDisplayName(pin.pageName)
        return `### ${heading}\n- «${name}» (id: \`${pin.pageId}\`)`
      })
      .join('\n\n') +
    `\nRegenera o modifica **solo** esas pantallas. No crees pantallas nuevas ni cambies otras del lienzo.\n`
  )
}

export function pinFromElement(
  element: ElementDescriptor,
  pageId: string,
  pageName: string,
): DesignElementContextPin {
  return {
    skId: element.skId,
    tagName: element.tagName,
    text: element.text,
    pageId,
    pageName,
    rect: element.rect,
  }
}

export function elementPinKey(pin: DesignElementContextPin): string {
  return `${pin.pageId}:${pin.skId}`
}

export function nextElementPinLabel(pins: DesignElementContextPin[]): string {
  return `select${pins.length + 1}`
}

export function elementContextMarkerDetail(pin: DesignElementContextPin): string {
  const page = normalizePageDisplayName(pin.pageName)
  const el = `${pin.tagName}${pin.skId ? ` · ${pin.skId}` : ''}`
  const full = `${page} — ${el}`
  if (pin.description?.trim()) {
    const snippet = pin.description.trim()
    return `${full} — ${snippet.length > 120 ? `${snippet.slice(0, 117)}…` : snippet}`
  }
  if (pin.text?.trim()) {
    const snippet = pin.text.trim()
    return `${full} — ${snippet.length > 120 ? `${snippet.slice(0, 117)}…` : snippet}`
  }
  return full
}

export function elementPinsPromptSuffix(pins: DesignElementContextPin[]): string {
  if (!pins.length) return ''
  if (pins.length === 1) return elementContextPromptSuffix(pins[0]!)
  return (
    `\n\n## Elementos objetivo (${pins.length})\n` +
    pins
      .map((pin, i) => {
        const heading = pin.label ?? `select${i + 1}`
        return (
          `### ${heading}\n` +
          `- Pantalla «${normalizePageDisplayName(pin.pageName)}»: \`<${pin.tagName}>\` con \`data-sk-id="${pin.skId}"\`` +
          (pin.description
            ? `\n- Qué cambiar: ${pin.description}`
            : pin.text
              ? `\n- Texto actual: «${pin.text}»`
              : '')
        )
      })
      .join('\n\n') +
    `\nAplica los cambios solo en esos elementos. Si pides crear o cambiar imágenes, sustituye únicamente las de esos elementos.\n`
  )
}

export function elementContextMarkerLabel(pin: DesignElementContextPin): string {
  return pin.label ?? 'select'
}

export function elementContextPromptSuffix(pin: DesignElementContextPin): string {
  const heading = pin.label ?? 'select1'
  return (
    `\n\n## Elemento objetivo (${heading})\n` +
    `Aplica los cambios solo en la pantalla «${normalizePageDisplayName(pin.pageName)}», elemento:\n` +
    `- \`<${pin.tagName}>\` con \`data-sk-id="${pin.skId}"\`\n` +
    (pin.description
      ? `- Qué cambiar: ${pin.description}\n`
      : pin.text
        ? `- Texto actual: «${pin.text}»\n`
        : '') +
    `- Si pides crear o cambiar una imagen, sustituye únicamente la de este elemento; no regeneres otras imágenes de la página.\n`
  )
}

export function toIterateElementContext(pin: DesignElementContextPin) {
  return {
    skId: pin.skId,
    tagName: pin.tagName,
    text: pin.text,
  }
}

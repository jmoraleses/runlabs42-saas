import { formatPinAreaLabel, pinAreaWithDefaults, type PinAreaPercent } from '@/lib/visual-edit/canvasPinArea'

export type { PinAreaPercent } from '@/lib/visual-edit/canvasPinArea'
export { pinAreaWithDefaults, formatPinAreaLabel } from '@/lib/visual-edit/canvasPinArea'

/** Marcador de área en el preview (herramienta + del canvas). */

export type CanvasPinKind = 'area' | 'image'

export type CanvasPin = PinAreaPercent & {
  id: string
  /** Pantalla del lienzo donde se marcó el área (% relativos al preview de esa página). */
  pageId?: string
  pageName?: string
  /** Etiqueta corta en el chat (p. ej. area1, img2). */
  label?: string
  kind?: CanvasPinKind
  /** Descripción breve: imagen, texto, vídeo, código, etc. */
  description: string
  elementSkId?: string
  elementTag?: string
}

export function nextCanvasPinLabel(pins: CanvasPin[], kind: CanvasPinKind): string {
  const count = pins.filter((p) => (p.kind ?? 'area') === kind).length
  return kind === 'image' ? `img${count + 1}` : `area${count + 1}`
}

export function createCanvasPinId(): string {
  return `pin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Bloque de instrucciones para la IA al enviar el chat con marcadores adjuntos. */
export function buildCanvasPinsPromptSuffix(pins: CanvasPin[]): string {
  if (!pins.length) return ''

  const lines = [
    '',
    '## Marcadores en el preview (ubicaciones solicitadas)',
    'El usuario colocó marcadores en el preview del sitio. Implementa **todo** lo descrito en cada uno en el código del proyecto.',
    'Usa el **área rectangular** (% del canvas) y el elemento DOM cercano (si existe) para ubicar y dimensionar cada cambio.',
    '',
  ]

  pins.forEach((pin, index) => {
    const area = pinAreaWithDefaults(pin)
    const heading = pin.label || `Marcador ${index + 1}`
    lines.push(`### ${heading}`)
    if (pin.pageName) {
      lines.push(`- Pantalla: «${pin.pageName}»${pin.pageId ? ` (id: ${pin.pageId})` : ''}`)
    }
    lines.push(
      `- Área en el preview (esquina superior izquierda): ${area.xPercent.toFixed(1)}% horizontal, ${area.yPercent.toFixed(1)}% vertical`,
    )
    lines.push(
      `- Tamaño del área: ${area.widthPercent.toFixed(1)}% de ancho × ${area.heightPercent.toFixed(1)}% de alto (respecto al canvas del preview)`,
    )
    if (pin.elementSkId) {
      lines.push(`- Elemento cercano: <${pin.elementTag ?? 'elemento'}> · \`${pin.elementSkId}\``)
    }
    lines.push(`- Qué crear o cambiar: ${pin.description}`)
    lines.push('')
  })

  lines.push(
    'Genera JSX/HTML válido con `data-sk-id` en nodos nuevos cuando corresponda. No omitas ningún marcador.',
  )
  return lines.join('\n')
}

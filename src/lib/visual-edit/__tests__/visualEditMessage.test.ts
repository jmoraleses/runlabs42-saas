import { describe, expect, it } from 'vitest'
import { buildVisualEditMessage, parseVisualEditFromContent } from '@/lib/visual-edit/visualEditMessage'
import type { ElementDescriptor } from '@/lib/visual-edit/protocol'

const element: ElementDescriptor = {
  skId: 'sk-31',
  tagName: 'img',
  rect: { top: 0, left: 0, width: 100, height: 80 },
  styles: { color: 'rgb(45,45,45)' },
  source: { file: 'src/App.tsx', line: 10 },
}

describe('buildVisualEditMessage', () => {
  it('genera prompt largo y meta compacta', () => {
    const { content, visualEdit } = buildVisualEditMessage(
      element,
      'crea la imagen de un evento corporativo',
    )
    expect(content).toContain('data-sk-id')
    expect(visualEdit.userPrompt).toBe('crea la imagen de un evento corporativo')
    expect(visualEdit.elementTag).toBe('img')
    expect(visualEdit.elementId).toBe('sk-31')
  })
})

describe('parseVisualEditFromContent', () => {
  it('extrae pedido de mensajes antiguos', () => {
    const { content } = buildVisualEditMessage(element, 'Hazlo más grande')
    const parsed = parseVisualEditFromContent(content)
    expect(parsed?.userPrompt).toBe('Hazlo más grande')
    expect(parsed?.elementTag).toBe('img')
  })
})

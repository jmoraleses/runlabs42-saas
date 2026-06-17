import { describe, expect, it } from 'vitest'
import { buildChatHistoryBlock } from '@/lib/ai/chatHistory'

describe('buildChatHistoryBlock', () => {
  it('incluye mensajes recientes', () => {
    const block = buildChatHistoryBlock([
      { role: 'user', content: 'Haz un formulario' },
      { role: 'assistant', content: 'Listo, aquí está el código.' },
    ])
    expect(block).toContain('Historial reciente')
    expect(block).toContain('Haz un formulario')
    expect(block).toContain('Listo')
  })

  it('devuelve vacío sin mensajes', () => {
    expect(buildChatHistoryBlock([])).toBe('')
  })

  it('respeta presupuesto de tokens', () => {
    const long = 'x'.repeat(50_000)
    const block = buildChatHistoryBlock(
      [
        { role: 'user', content: long },
        { role: 'assistant', content: long },
      ],
      { maxTokens: 100 },
    )
    expect(block.length).toBeLessThan(50_000)
  })
})

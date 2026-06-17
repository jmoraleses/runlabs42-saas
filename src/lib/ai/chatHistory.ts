import type { ChatMessage } from '@/lib/chat/types'

/** ~4 chars por token (estimación conservadora). */
const CHARS_PER_TOKEN = 4

export const DEFAULT_CHAT_HISTORY_TOKEN_BUDGET = 12_000

export type ChatHistoryBudgetOptions = {
  maxTokens?: number
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = Math.max(0, maxTokens * CHARS_PER_TOKEN)
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}…`
}

/** Bloque de historial para el prompt del modelo (sin imágenes). Respeta presupuesto de tokens. */
export function buildChatHistoryBlock(
  messages: ChatMessage[],
  opts?: ChatHistoryBudgetOptions,
): string {
  const budget = opts?.maxTokens ?? DEFAULT_CHAT_HISTORY_TOKEN_BUDGET
  const relevant = messages.filter((m) => m.content.trim())
  if (!relevant.length) return ''

  const header = [
    '',
    '## Historial reciente del chat (contexto de la conversación)',
    '',
  ]
  const footer =
    'Usa este historial para mantener coherencia. El mensaje actual del usuario es el pedido principal.'

  let used = estimateTokens([...header, footer].join('\n'))
  const lines: string[] = [...header]

  for (let i = relevant.length - 1; i >= 0; i--) {
    const m = relevant[i]!
    const role = m.role === 'user' ? 'Usuario' : 'Asistente'
    const block = `**${role}:**\n${m.content}\n`
    const need = estimateTokens(block)
    if (used + need > budget) {
      const remaining = budget - used - estimateTokens(`**${role}:**\n\n`)
      if (remaining > 80) {
        lines.unshift(`**${role}:**`, truncateToTokens(m.content, remaining), '')
      }
      break
    }
    lines.splice(header.length, 0, `**${role}:**`, m.content, '')
    used += need
  }

  if (lines.length <= header.length) return ''

  lines.push(footer)
  return lines.join('\n')
}

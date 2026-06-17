import type { ChatInsightPayload } from '@/lib/ai/chatInsight'
import type { ChatMessage } from '@/lib/chat/types'

export function chatInsightAssistantMessage(insight: ChatInsightPayload): ChatMessage {
  return { role: 'assistant', content: '', chatInsight: insight }
}

/**
 * Inserta la burbuja de insight justo antes del asistente en streaming (último mensaje vacío).
 */
export function appendChatInsightMessage(
  messages: ChatMessage[],
  insight: ChatInsightPayload,
): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last?.role === 'assistant' && last.chatInsight) {
    return [...messages.slice(0, -1), chatInsightAssistantMessage(insight)]
  }
  if (last?.role === 'assistant' && !last.content?.trim() && !last.studioEvent) {
    return [...messages.slice(0, -1), chatInsightAssistantMessage(insight), last]
  }
  return [...messages, chatInsightAssistantMessage(insight)]
}

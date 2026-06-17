import { parseCompileError } from '@/lib/preview/parseCompileError'
import type { ChatMessage } from '@/lib/chat/types'

export type ChatStudioEvent =
  | { kind: 'compile-error'; summary: string; file?: string }
  | { kind: 'compile-fixing'; file: string; attempt: number; max: number }
  | { kind: 'compile-fixed'; file?: string }
  | { kind: 'compile-failed' }

export function summarizeCompileError(
  errorText: string,
  knownPaths: string[],
): { summary: string; file?: string } {
  const parsed = parseCompileError(errorText, knownPaths)
  const lines = errorText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const firstLine =
    lines.find((l) => l.length > 8 && !/^at\s+/i.test(l)) ?? lines[0] ?? errorText.trim()
  return {
    summary: firstLine.slice(0, 240),
    file: parsed.primaryPath ?? parsed.targetPaths[0] ?? undefined,
  }
}

function studioAssistantMessage(event: ChatStudioEvent): ChatMessage {
  return { role: 'assistant', content: '', studioEvent: event }
}

/** Quita burbujas «Corrigiendo…» que quedaron colgadas en el historial. */
export function stripCompileFixingMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(
    (m) => !(m.role === 'assistant' && m.studioEvent?.kind === 'compile-fixing'),
  )
}

/**
 * Inserta o sustituye eventos de studio en el chat sin dejar spinners huérfanos.
 */
export function appendStudioChatEvent(
  messages: ChatMessage[],
  event: ChatStudioEvent,
): ChatMessage[] {
  if (event.kind === 'compile-fixing') {
    return [...stripCompileFixingMessages(messages), studioAssistantMessage(event)]
  }

  if (event.kind === 'compile-fixed' || event.kind === 'compile-failed') {
    return [...stripCompileFixingMessages(messages), studioAssistantMessage(event)]
  }

  if (event.kind === 'compile-error') {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && last.studioEvent?.kind === 'compile-error') {
      const prev = last.studioEvent
      const sameFile = event.file && prev.file && event.file === prev.file
      const sameSummary = event.summary === prev.summary
      if (sameFile || sameSummary) {
        return [...messages.slice(0, -1), studioAssistantMessage(event)]
      }
    }
    if (last?.role === 'assistant' && last.studioEvent?.kind === 'compile-fixing') {
      return [...messages.slice(0, -1), studioAssistantMessage(event)]
    }
    return [...messages, studioAssistantMessage(event)]
  }

  return [...messages, studioAssistantMessage(event)]
}

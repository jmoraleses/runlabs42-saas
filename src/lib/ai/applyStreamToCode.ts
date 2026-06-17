import { parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'

/** @deprecated Usar parseFileOperationsFromStream + applyFileOperations en el workspace. */
export function extractCodeFromStream(accumulated: string): string | null {
  const ops = parseFileOperationsFromStream(accumulated)
  const last = ops[ops.length - 1]
  if (last && last.type !== 'delete') return last.content
  return null
}

export function applyStreamChunkToCode(current: string, chunk: string, accumulated: string): string {
  const extracted = extractCodeFromStream(accumulated)
  if (extracted) return extracted
  if (chunk.includes('```')) return current
  return current
}

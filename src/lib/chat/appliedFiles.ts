import type { FileOperation } from '@/lib/ai/fileOperations'
import type { ChatAppliedFile } from '@/lib/chat/types'

export function buildChatAppliedFiles(
  ops: FileOperation[],
  options: {
    pathsBefore?: Set<string>
    buffers: Record<string, { content?: string } | undefined>
    extraPaths?: string[]
  },
): ChatAppliedFile[] {
  const seen = new Set<string>()
  const out: ChatAppliedFile[] = []
  const pathsBefore = options.pathsBefore ?? new Set<string>()

  const add = (path: string, action?: 'create' | 'update') => {
    if (!path || seen.has(path)) return
    seen.add(path)
    const content = options.buffers[path]?.content ?? ''
    const lines = content ? content.split('\n').length : 0
    out.push({
      path,
      action: action ?? (pathsBefore.has(path) ? 'update' : 'create'),
      lines,
      sizeBytes: content.length,
    })
  }

  for (const op of ops) {
    if (op.type === 'delete') continue
    add(op.path, pathsBefore.has(op.path) ? 'update' : 'create')
  }
  for (const path of options.extraPaths ?? []) {
    add(path)
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

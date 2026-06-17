import type { FileOperation } from '@/lib/ai/fileOperations'

export type WorkspaceBuffer = {
  content: string
  dirty: boolean
  language: string
}

export type WorkspaceBuffers = Record<string, WorkspaceBuffer>

export function applyFileOperations(
  buffers: WorkspaceBuffers,
  ops: FileOperation[],
): { buffers: WorkspaceBuffers; touched: string[]; deleted: string[] } {
  const next = { ...buffers }
  const touched: string[] = []
  const deleted: string[] = []

  for (const op of ops) {
    if (op.type === 'delete') {
      delete next[op.path]
      deleted.push(op.path)
      continue
    }
    const language = op.language ?? inferLanguage(op.path)
    next[op.path] = { content: op.content, dirty: true, language }
    touched.push(op.path)
  }

  return { buffers: next, touched, deleted }
}

function inferLanguage(path: string): string {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript'
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.md')) return 'markdown'
  if (path.endsWith('.html')) return 'html'
  return 'plaintext'
}

export function buffersFromFileList(
  files: { path: string; content: string; language?: string | null }[],
): WorkspaceBuffers {
  const out: WorkspaceBuffers = {}
  for (const f of files) {
    out[f.path] = {
      content: f.content,
      dirty: false,
      language: f.language ?? inferLanguage(f.path),
    }
  }
  return out
}

export function fileListFromBuffers(buffers: WorkspaceBuffers): { path: string; content: string }[] {
  return Object.entries(buffers).map(([path, b]) => ({ path, content: b.content }))
}

/** Comprueba si los buffers ya contienen el contenido de las operaciones del stream. */
export function fileOpsMatchBuffers(
  buffers: WorkspaceBuffers,
  ops: FileOperation[],
): boolean {
  const updates = ops.filter((o) => o.type !== 'delete')
  if (!updates.length) return false
  return updates.every((op) => {
    const buf = buffers[op.path]
    if (!buf?.content?.trim()) return false
    return buf.content.trimEnd() === op.content.trimEnd()
  })
}

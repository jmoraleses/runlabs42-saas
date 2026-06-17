import type { FileOperation } from '@/lib/ai/fileOperations'

/** Evita que una corrección puntual reescriba archivos no solicitados. */
export function filterFileOpsToPaths(
  ops: FileOperation[],
  allowedPaths: string[],
): FileOperation[] {
  const allowed = new Set(allowedPaths)
  return ops.filter((op) => {
    if (op.type === 'delete') return allowed.has(op.path)
    return allowed.has(op.path)
  })
}

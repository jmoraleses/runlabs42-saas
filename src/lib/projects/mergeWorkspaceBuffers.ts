import type { WorkspaceBuffers } from '@/lib/ai/applyFileOperations'
import { buffersFromFileList } from '@/lib/ai/applyFileOperations'
import { isValidWorkspacePath } from '@/lib/projects/workspacePath'

type FileRow = { path: string; content: string; language?: string | null }

/**
 * Fusiona archivos del servidor con buffers locales: conserva rutas locales
 * dirty o que aún no existen en el servidor (p. ej. archivos nuevos de la IA).
 */
export function mergeWorkspaceBuffers(
  local: WorkspaceBuffers,
  serverFiles: FileRow[],
): WorkspaceBuffers {
  const fromServer = buffersFromFileList(
    serverFiles.filter((f) => isValidWorkspacePath(f.path)),
  )
  if (fromServer['src/App.tsx'] && fromServer['App.tsx']) {
    delete fromServer['App.tsx']
  }

  const merged: WorkspaceBuffers = { ...fromServer }
  for (const [path, buf] of Object.entries(local)) {
    if (!isValidWorkspacePath(path)) continue
    if (buf.dirty || !fromServer[path]) {
      merged[path] = buf
    }
  }
  return merged
}

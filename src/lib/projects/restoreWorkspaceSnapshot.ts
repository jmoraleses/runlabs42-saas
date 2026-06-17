'use client'

import { apiFetch } from '@/lib/api/client'
import type { WorkspaceSnapshot } from '@/lib/chat/workspaceSnapshots'
import { isDemoProjectId, saveDemoProjectSpec } from '@/lib/auth/demo'
import {
  isSpecWorkspacePath,
  migrateSpecFiles,
  SPEC_KIT_PATHS,
} from '@/lib/projects/specPaths'
import { projectFileContentUrl } from '@/lib/projects/projectFilesApi'

/** Restaura archivos y spec del proyecto al estado capturado (elimina archivos sobrantes). */
export async function restoreWorkspaceToProject(
  projectId: string,
  snapshot: WorkspaceSnapshot,
): Promise<void> {
  const migrated = migrateSpecFiles(snapshot.files)
  if (snapshot.spec.trim() && !migrated.some((f) => f.path === SPEC_KIT_PATHS.spec)) {
    migrated.push({ path: SPEC_KIT_PATHS.spec, content: snapshot.spec })
  }
  const files = migrated.map((f) => ({
    path: f.path,
    content: f.content,
    language: f.path.endsWith('.tsx') ? 'typescript' : 'plaintext',
  }))
  const snapPaths = new Set(files.map((f) => f.path))

  const data = await apiFetch<{ files: { path: string }[] }>(`/api/projects/${projectId}/files`)
  const current = data.files ?? []
  for (const f of current) {
    if (!snapPaths.has(f.path) && !isSpecWorkspacePath(f.path)) {
      await apiFetch(projectFileContentUrl(projectId, f.path), { method: 'DELETE' })
    }
  }
  if (files.length) {
    await apiFetch(`/api/projects/${projectId}/files`, {
      method: 'PUT',
      body: JSON.stringify({ files }),
    })
  }
  const specText =
    files.find((f) => f.path === SPEC_KIT_PATHS.spec)?.content ?? snapshot.spec
  if (isDemoProjectId(projectId)) {
    saveDemoProjectSpec(projectId, specText)
  } else {
    await apiFetch(`/api/projects/${projectId}/spec`, {
      method: 'PUT',
      body: JSON.stringify({ content: specText }),
    })
  }
}

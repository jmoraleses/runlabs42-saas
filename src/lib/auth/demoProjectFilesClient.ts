'use client'

import { apiFetch } from '@/lib/api/client'
import {
  DEMO_PROJECT_FILES_STORAGE_KEY,
  type DemoProjectFile,
} from '@/lib/auth/demo'

function readLegacyFiles(projectId: string): DemoProjectFile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DEMO_PROJECT_FILES_STORAGE_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, DemoProjectFile[]>) : {}
    return all[projectId] ?? []
  } catch {
    return []
  }
}

function clearLegacyFiles(projectId: string) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(DEMO_PROJECT_FILES_STORAGE_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, DemoProjectFile[]>) : {}
    if (!all[projectId]) return
    delete all[projectId]
    window.localStorage.setItem(DEMO_PROJECT_FILES_STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

/** Migra archivos demo de localStorage a API (.data/ o Blob). */
export async function migrateDemoProjectFilesFromLocalStorage(
  projectId: string,
): Promise<void> {
  const legacy = readLegacyFiles(projectId)
  if (!legacy.length) return

  try {
    const data = await apiFetch<{ files: { path: string }[] }>(
      `/api/projects/${projectId}/files`,
    )
    if ((data.files ?? []).length > 0) {
      clearLegacyFiles(projectId)
      return
    }
    await apiFetch(`/api/projects/${projectId}/files`, {
      method: 'PUT',
      body: JSON.stringify({
        files: legacy.map((f) => ({
          path: f.path,
          content: f.content,
          language: f.language,
        })),
      }),
    })
    clearLegacyFiles(projectId)
  } catch {
    /* conservar localStorage si la API no está disponible */
  }
}

export async function fetchDemoProjectFiles(projectId: string): Promise<DemoProjectFile[]> {
  await migrateDemoProjectFilesFromLocalStorage(projectId)
  const data = await apiFetch<{
    files: { path: string; content: string; language?: string | null }[]
  }>(`/api/projects/${projectId}/files`)
  return (data.files ?? []).map((f) => ({
    path: f.path,
    content: f.content,
    language: f.language ?? null,
  }))
}

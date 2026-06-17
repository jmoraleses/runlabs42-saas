'use client'

import { apiFetch } from '@/lib/api/client'
import { normalizeProject, normalizeProjects } from '@/lib/api/projects'
import type { WorkspaceBuffers } from '@/lib/ai/applyFileOperations'
import { fileListFromBuffers } from '@/lib/ai/applyFileOperations'
import {
  createDemoProject,
  isDemoActive,
  isDemoProjectId,
  loadDemoProjectSpec,
  loadDemoProjects,
  removeDemoProject,
  saveDemoProjectSpec,
  type DemoProjectFile,
} from '@/lib/auth/demo'
import { inferLanguage } from '@/lib/projects/access'
import { hasSpecWorkspaceContent, specContentFromFiles } from '@/lib/projects/specPaths'
import { nextGenericProjectName, type StudioLang } from '@/lib/projects/genericProjectName'
import type { Project } from '@/types'

const STUDIO_FRAMEWORK = 'react'

function mergeSnapshot(
  snapshot: WorkspaceBuffers,
  activeOverride?: { path: string; content: string } | null,
): WorkspaceBuffers {
  const merged: WorkspaceBuffers = { ...snapshot }
  if (activeOverride?.path) {
    const cur = merged[activeOverride.path]
    merged[activeOverride.path] = {
      content: activeOverride.content,
      dirty: true,
      language: cur?.language ?? inferLanguage(activeOverride.path),
    }
  }
  return merged
}

/** Hay contenido que justifica persistir el proyecto (archivos o spec con texto). */
export function workspaceHasMeaningfulContent(
  snapshot: WorkspaceBuffers,
  activeOverride?: { path: string; content: string } | null,
  specContent?: string,
): boolean {
  if (specContent?.trim()) return true
  const merged = mergeSnapshot(snapshot, activeOverride)
  const files = fileListFromBuffers(merged)
  if (hasSpecWorkspaceContent(files)) return true
  return files.some((f) => f.content.trim().length > 0)
}

export async function createStudioProject(lang: StudioLang = 'es'): Promise<Project> {
  if (isDemoActive()) {
    const projects = loadDemoProjects()
    const name = nextGenericProjectName(
      projects.map((p) => p.name),
      lang,
    )
    return createDemoProject(name, STUDIO_FRAMEWORK)
  }

  const listRes = await apiFetch<{ projects: unknown }>('/api/projects')
  const projects = normalizeProjects(listRes.projects)
  const name = nextGenericProjectName(
    projects.map((p) => p.name),
    lang,
  )
  const data = await apiFetch<{ project?: unknown }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, framework: STUDIO_FRAMEWORK }),
  })
  const project = normalizeProject(data.project)
  if (!project) throw new Error('No se pudo crear el proyecto')
  return project
}

export async function saveWorkspaceToProject(
  projectId: string,
  snapshot: WorkspaceBuffers,
  activeOverride?: { path: string; content: string } | null,
  specContent?: string,
): Promise<void> {
  const merged = mergeSnapshot(snapshot, activeOverride)
  const files = fileListFromBuffers(merged).map(
    (f): DemoProjectFile => ({
      path: f.path,
      content: f.content,
      language: f.path.endsWith('.tsx') ? 'typescript' : 'plaintext',
    }),
  )

  if (files.length) {
    await apiFetch(`/api/projects/${projectId}/files`, {
      method: 'PUT',
      body: JSON.stringify({ files }),
    })
  }
  const specFromFiles = specContentFromFiles(files)
  const specPayload =
    specContent !== undefined
      ? specContent
      : specFromFiles.trim()
        ? specFromFiles
        : undefined
  if (specPayload !== undefined) {
    if (isDemoProjectId(projectId)) {
      saveDemoProjectSpec(projectId, specPayload)
    } else {
      await apiFetch(`/api/projects/${projectId}/spec`, {
        method: 'PUT',
        body: JSON.stringify({ content: specPayload }),
      })
    }
  }
}

/** Elimina proyectos sin archivos ni spec (p. ej. se abrió Studio y se salió sin editar). */
export async function pruneEmptyStudioProject(projectId: string): Promise<void> {
  if (isDemoProjectId(projectId)) {
    const data = await apiFetch<{ files: { path: string }[] }>(
      `/api/projects/${projectId}/files`,
    )
    const spec = loadDemoProjectSpec(projectId)
    if ((data.files ?? []).length === 0 && !spec.trim()) removeDemoProject(projectId)
    return
  }

  try {
    const data = await apiFetch<{ files: { path: string }[] }>(
      `/api/projects/${projectId}/files`,
    )
    const files = data.files ?? []
    if (files.length > 0) return
    const { spec } = await apiFetch<{ spec?: { content?: string } }>(
      `/api/projects/${projectId}/spec`,
    )
    if (spec?.content?.trim()) return
    await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE' })
  } catch {
    /* ignore */
  }
}

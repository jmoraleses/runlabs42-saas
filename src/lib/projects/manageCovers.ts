import { apiFetch } from '@/lib/api/client'
import { findDemoProject, isDemoProjectId, updateDemoProject } from '@/lib/auth/demo'

export const MAX_PROJECT_COVERS = 5

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

/** Reemplaza el array de portadas (reordenar o eliminar). */
export async function setProjectCoverImages(
  projectId: string,
  coverImages: string[],
): Promise<string[]> {
  const urls = coverImages.filter(Boolean).slice(0, MAX_PROJECT_COVERS)

  if (isDemoProjectId(projectId)) {
    updateDemoProject(projectId, {
      coverUrl: urls[0] ?? null,
      coverImages: urls.length ? urls : null,
    })
    return urls
  }

  const res = await apiFetch<{ urls: string[] }>(`/api/projects/${projectId}/cover`, {
    method: 'PATCH',
    body: JSON.stringify({ coverImages: urls }),
  })
  return res.urls ?? urls
}

/** Añade una imagen al final (data URL o base64). */
export async function appendProjectCoverImage(
  projectId: string,
  imageData: string,
): Promise<string[]> {
  if (isDemoProjectId(projectId)) {
    const project = findDemoProject(projectId)
    const current = project?.coverImages?.length
      ? [...project.coverImages]
      : project?.coverUrl
        ? [project.coverUrl]
        : []
    if (current.length >= MAX_PROJECT_COVERS) {
      throw new Error('max_covers')
    }
    const urls = [...current, imageData]
    updateDemoProject(projectId, { coverUrl: urls[0], coverImages: urls })
    return urls
  }

  const res = await apiFetch<{ urls: string[] }>(`/api/projects/${projectId}/cover`, {
    method: 'PATCH',
    body: JSON.stringify({ imageData }),
  })
  return res.urls ?? []
}

/**
 * Añade una captura en buffer circular: si ya hay MAX_PROJECT_COVERS imágenes,
 * elimina la más antigua (índice 0) antes de añadir la nueva al final.
 */
export async function captureAndAppendCover(
  projectId: string,
  imageData: string,
): Promise<string[]> {
  if (isDemoProjectId(projectId)) {
    const project = findDemoProject(projectId)
    const current: string[] = project?.coverImages?.length
      ? [...project.coverImages]
      : project?.coverUrl
        ? [project.coverUrl]
        : []
    const next = current.length >= MAX_PROJECT_COVERS
      ? [...current.slice(1), imageData]
      : [...current, imageData]
    updateDemoProject(projectId, { coverUrl: next[0], coverImages: next })
    return next
  }

  const res = await apiFetch<{ urls: string[] }>(`/api/projects/${projectId}/cover`, {
    method: 'PATCH',
    body: JSON.stringify({ imageData, allowOverwrite: true }),
  })
  return res.urls ?? []
}

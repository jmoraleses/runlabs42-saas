'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { isDemoProjectId } from '@/lib/auth/demo'
import { migrateDemoProjectFilesFromLocalStorage } from '@/lib/auth/demoProjectFilesClient'
import { isSpecWorkspacePath } from '@/lib/projects/specPaths'
import { projectFileContentUrl } from '@/lib/projects/projectFilesApi'

export type ProjectFile = {
  id?: string
  path: string
  content: string
  language?: string | null
  updatedAt?: string
}

export function useProjectFiles(projectId: string | null) {
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Debounce por ruta (un timer único compartido cancelaría el guardado
  // pendiente de un archivo al editar otro y perdería cambios).
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pendingSaves = useRef<Map<string, () => Promise<void>>>(new Map())

  const refresh = useCallback(async () => {
    if (!projectId) {
      setFiles([])
      return
    }
    setLoading(true)
    try {
      if (isDemoProjectId(projectId)) {
        await migrateDemoProjectFilesFromLocalStorage(projectId)
      }
      const data = await apiFetch<{ files: ProjectFile[] }>(`/api/projects/${projectId}/files`)
      setFiles(data.files ?? [])
    } catch {
      setFiles([])
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveFile = useCallback(
    async (path: string, content: string, debounceMs = 0) => {
      const trimmedPath = path.trim()
      if (!projectId || !trimmedPath) return
      const doSave = async () => {
        const pendingTimer = saveTimers.current.get(trimmedPath)
        if (pendingTimer) {
          clearTimeout(pendingTimer)
          saveTimers.current.delete(trimmedPath)
        }
        pendingSaves.current.delete(trimmedPath)
        setSaving(true)
        setSaveError(null)
        const applyLocal = (prev: ProjectFile[]) => {
          const idx = prev.findIndex((f) => f.path === trimmedPath)
          const next = {
            path: trimmedPath,
            content,
            language: trimmedPath.endsWith('.tsx') ? 'typescript' : 'plaintext',
          }
          if (idx >= 0) {
            const copy = [...prev]
            copy[idx] = { ...copy[idx], ...next }
            return copy
          }
          return [...prev, next]
        }
        try {
          await apiFetch(`/api/projects/${projectId}/files`, {
            method: 'PUT',
            body: JSON.stringify({ path: trimmedPath, content }),
          })
          setFiles((prev) => applyLocal(prev))
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'No se pudieron guardar los archivos'
          setSaveError(msg)
          throw e
        } finally {
          setSaving(false)
        }
      }
      if (debounceMs > 0) {
        const prev = saveTimers.current.get(trimmedPath)
        if (prev) clearTimeout(prev)
        pendingSaves.current.set(trimmedPath, doSave)
        saveTimers.current.set(
          trimmedPath,
          setTimeout(() => {
            void doSave()
          }, debounceMs),
        )
      } else {
        await doSave()
      }
    },
    [projectId],
  )

  const saveFilesBatch = useCallback(
    async (batch: { path: string; content: string }[], overridePid?: string) => {
      const pid = overridePid ?? projectId
      if (!pid || !batch.length) return
      setSaving(true)
      setSaveError(null)
      try {
        await apiFetch(`/api/projects/${pid}/files`, {
          method: 'PUT',
          body: JSON.stringify({ files: batch }),
        })
        setFiles((prev) => {
          const copy = [...prev]
          for (const f of batch) {
            const idx = copy.findIndex((x) => x.path === f.path)
            const next = {
              path: f.path,
              content: f.content,
              language: f.path.endsWith('.tsx') ? 'typescript' : 'plaintext',
            }
            if (idx >= 0) copy[idx] = { ...copy[idx], ...next }
            else copy.push(next)
          }
          return copy
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudieron guardar los archivos'
        setSaveError(msg)
        throw new Error(msg)
      } finally {
        setSaving(false)
      }
    },
    [projectId],
  )

  const removeFile = useCallback(
    async (path: string) => {
      if (!projectId || isSpecWorkspacePath(path)) return
      setSaving(true)
      setSaveError(null)
      try {
        await apiFetch(projectFileContentUrl(projectId, path), { method: 'DELETE' })
        setFiles((prev) => prev.filter((f) => f.path !== path))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo eliminar el archivo'
        setSaveError(msg)
        throw new Error(msg)
      } finally {
        setSaving(false)
      }
    },
    [projectId],
  )

  // Ejecuta de inmediato cualquier guardado con debounce pendiente
  // (al cambiar de archivo, cerrar el editor o desmontar).
  const flushSaves = useCallback(async () => {
    const fns = [...pendingSaves.current.values()]
    pendingSaves.current.clear()
    for (const timer of saveTimers.current.values()) clearTimeout(timer)
    saveTimers.current.clear()
    await Promise.all(fns.map((fn) => fn().catch(() => {})))
  }, [])

  useEffect(() => {
    const timers = saveTimers.current
    const pending = pendingSaves.current
    return () => {
      const fns = [...pending.values()]
      pending.clear()
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      void Promise.all(fns.map((fn) => fn().catch(() => {})))
    }
  }, [])

  return {
    files,
    loading,
    saving,
    saveError,
    refresh,
    saveFile,
    saveFilesBatch,
    removeFile,
    flushSaves,
  }
}

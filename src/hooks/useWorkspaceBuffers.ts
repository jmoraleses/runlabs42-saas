'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyFileOperations,
  fileListFromBuffers,
  fileOpsMatchBuffers,
  type WorkspaceBuffers,
} from '@/lib/ai/applyFileOperations'
import type { FileOperation, ParsedSegment } from '@/lib/ai/fileOperations'
import { parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'
import { shouldApplyStreamSegment } from '@/lib/ai/shouldApplyStreamSegment'
import { inferLanguage } from '@/lib/projects/access'
import { previewEntryFileOps } from '@/lib/projects/ensurePreviewEntryFiles'
import { reconcilePreviewWorkspace } from '@/lib/projects/reconcilePreviewWorkspace'
import { mergeWorkspaceBuffers } from '@/lib/projects/mergeWorkspaceBuffers'
import { resolveStreamDefaultPath } from '@/lib/projects/resolveStreamDefaultPath'
import {
  isSpecWorkspacePath,
  migrateLegacySpecPath,
  migrateSpecFiles,
} from '@/lib/projects/specPaths'
import { isValidWorkspacePath, resolveWorkspacePath } from '@/lib/projects/workspacePath'
import { useProjectFiles, type ProjectFile } from '@/hooks/useProjectFiles'
import {
  pruneEmptyStudioProject,
  workspaceHasMeaningfulContent,
} from '@/lib/projects/studioCommit'
import {
  stripLegalBoilerplateFromContent,
  stripLegalBoilerplateFromFiles,
} from '@/lib/preview/stripLegalBoilerplate'

const DEFAULT_PATH = 'src/App.tsx'

/** Misma normalización de rutas/contenido que `applyOps` al finalizar el stream. */
export function cleanStreamFileOps(
  ops: FileOperation[],
  existingPaths: string[],
  options?: { addPreviewEntries?: boolean },
): FileOperation[] {
  const cleanedOps: FileOperation[] = []
  const paths = [...existingPaths]
  for (const op of ops) {
    if (op.type === 'delete') {
      const delPath = migrateLegacySpecPath(op.path)
      if (!isValidWorkspacePath(delPath) || isSpecWorkspacePath(delPath)) continue
      cleanedOps.push({ ...op, path: delPath })
      continue
    }
    const path = migrateLegacySpecPath(
      resolveWorkspacePath(op.path, {
        fallback: DEFAULT_PATH,
        existingPaths: paths,
      }),
    )
    const content = stripLegalBoilerplateFromContent(path, op.content)
    if (!content.trim() && /\.(tsx|jsx|ts|js)$/i.test(path)) continue
    cleanedOps.push({ ...op, path, content })
    if (!paths.includes(path)) paths.push(path)
  }

  const pathsAfterOps = new Set(paths)
  for (const op of cleanedOps) {
    if (op.type !== 'delete') pathsAfterOps.add(op.path)
  }
  if (options?.addPreviewEntries === true) {
    for (const entry of previewEntryFileOps([...pathsAfterOps])) {
      cleanedOps.push(entry)
    }
  }

  return cleanedOps
}

export function useWorkspaceBuffers(projectId: string | null) {
  const { files, loading, saving, saveFile, saveFilesBatch, refresh, removeFile, flushSaves } =
    useProjectFiles(projectId)
  const [buffers, setBuffers] = useState<WorkspaceBuffers>({})
  const [activePath, setActivePath] = useState('')
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const bootstrappedRef = useRef(false)
  /** Proyecto cuyos archivos del servidor ya se cargaron en buffers (evita prune en Strict Mode). */
  const bootstrappedProjectRef = useRef<string | null>(null)
  const buffersRef = useRef<WorkspaceBuffers>({})

  useEffect(() => {
    buffersRef.current = buffers
  }, [buffers])

  // Limpia pestañas/archivos fantasma (ruta vacía) de sesiones anteriores.
  useEffect(() => {
    setOpenTabs((tabs) => {
      const valid = tabs.filter(isValidWorkspacePath)
      return valid.length === tabs.length ? tabs : valid
    })
    setBuffers((prev) => {
      const invalid = Object.keys(prev).filter((k) => !isValidWorkspacePath(k))
      if (!invalid.length) return prev
      const next = { ...prev }
      for (const k of invalid) delete next[k]
      return next
    })
  }, [])

  const persistSnapshot = useCallback(
    async (
      pid: string | null,
      snapshot: WorkspaceBuffers,
      activeOverride?: { path: string; content: string } | null,
    ) => {
      if (!pid) return
      const merged: WorkspaceBuffers = { ...snapshot }
      if (activeOverride?.path) {
        const cur = merged[activeOverride.path]
        merged[activeOverride.path] = {
          content: activeOverride.content,
          dirty: true,
          language: cur?.language ?? inferLanguage(activeOverride.path),
        }
      }
      if (!workspaceHasMeaningfulContent(snapshot, activeOverride)) {
        // Sin bootstrap, buffers vacíos al montar (p. ej. React Strict Mode en dev).
        if (bootstrappedProjectRef.current !== pid) return
        await pruneEmptyStudioProject(pid)
        return
      }
      await flushSaves()
      const dirty = fileListFromBuffers(merged).filter((f) => merged[f.path]?.dirty)
      if (!dirty.length) return
      await saveFilesBatch(
        dirty.map((f) => ({ path: f.path, content: f.content })),
      )
      const savedPaths = new Set(dirty.map((f) => f.path))
      setBuffers((prev) => {
        const next = { ...prev }
        for (const p of savedPaths) {
          const b = next[p]
          if (b) next[p] = { ...b, dirty: false }
        }
        return next
      })
    },
    [flushSaves, saveFilesBatch],
  )

  const persistNow = useCallback(
    async (
      activeOverride?: { path: string; content: string } | null,
      pidOverride?: string | null,
    ) => {
      const pid = pidOverride ?? projectId
      if (!pid) return
      await persistSnapshot(pid, { ...buffersRef.current }, activeOverride ?? null)
    },
    [projectId, persistSnapshot],
  )

  const persistBeforeLeave = useCallback(
    async (activeOverride?: { path: string; content: string } | null) => {
      if (!projectId) return
      await persistSnapshot(projectId, { ...buffersRef.current }, activeOverride ?? null)
    },
    [projectId, persistSnapshot],
  )

  // Al cambiar de proyecto o desmontar: persistir antes de vaciar buffers.
  useEffect(() => {
    const pid = projectId
    return () => {
      void persistSnapshot(pid, { ...buffersRef.current })
    }
  }, [projectId, persistSnapshot])

  useEffect(() => {
    bootstrappedRef.current = false
    bootstrappedProjectRef.current = null
    setBuffers({})
    setActivePath('')
    setOpenTabs([])
  }, [projectId])

  useEffect(() => {
    if (!projectId || loading) return
    if (!files.length) {
      // No vaciar buffers locales mientras la IA acaba de escribir y el guardado
      // en disco aún no ha devuelto la lista de archivos (proyectos demo vacíos).
      if (Object.keys(buffersRef.current).length > 0) return
      setBuffers({})
      setActivePath('')
      setOpenTabs([])
      return
    }
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    bootstrappedProjectRef.current = projectId
    const serverFiles = migrateSpecFiles(
      files.filter((f) => isValidWorkspacePath(f.path)),
    )
    const next = mergeWorkspaceBuffers(buffersRef.current, serverFiles)
    setBuffers(next)
    const paths = Object.keys(next).filter(isValidWorkspacePath)
    const preferred = paths.includes(DEFAULT_PATH) ? DEFAULT_PATH : (paths[0] ?? '')
    setActivePath(preferred)
    setOpenTabs(preferred ? [preferred] : [])
  }, [projectId, loading, files])

  // Tras importar o refrescar, añadir archivos nuevos sin pisar buffers en edición.
  useEffect(() => {
    if (!projectId || loading || !files.length || !bootstrappedRef.current) return
    setBuffers((prev) => {
      let changed = false
      const next = { ...prev }
      for (const f of migrateSpecFiles(files)) {
        if (!isValidWorkspacePath(f.path)) continue
        const existing = next[f.path]
        if (existing?.dirty) continue
        if (existing?.content === f.content) continue
        changed = true
        next[f.path] = {
          content: f.content,
          dirty: false,
          language: f.language ?? inferLanguage(f.path),
        }
      }
      return changed ? next : prev
    })
  }, [projectId, loading, files])

  const displayFiles = useMemo<ProjectFile[]>(() => {
    const map = new Map<string, ProjectFile>()
    for (const f of migrateSpecFiles(files.filter((row) => isValidWorkspacePath(row.path)))) {
      map.set(f.path, {
        path: f.path,
        content: f.content,
        language: f.language ?? inferLanguage(f.path),
      })
    }
    for (const [path, b] of Object.entries(buffers)) {
      if (!isValidWorkspacePath(path)) continue
      if (map.has(path) && !b.dirty) continue
      map.set(path, {
        path,
        content: b.content,
        language: b.language,
      })
    }
    return [...map.values()].sort((a, b) => a.path.localeCompare(b.path))
  }, [files, buffers])

  const activeBuffer = buffers[activePath]

  const updateActiveContent = useCallback(
    (content: string) => {
      setBuffers((prev) => {
        const cur = prev[activePath]
        if (!cur) return prev
        if (cur.content === content) return prev
        return {
          ...prev,
          [activePath]: { ...cur, content, dirty: true },
        }
      })
      if (projectId) saveFile(activePath, content, 1500)
    },
    [activePath, projectId, saveFile],
  )

  const updateFileContent = useCallback(
    (path: string, content: string, debounceMs = 0) => {
      if (!path) return
      setBuffers((prev) => {
        const cur = prev[path]
        if (!cur) return prev
        if (cur.content === content) return prev
        return {
          ...prev,
          [path]: { ...cur, content, dirty: true },
        }
      })
      if (projectId) void saveFile(path, content, debounceMs)
    },
    [projectId, saveFile],
  )

  const selectFile = useCallback(
    (path: string) => {
      // Persiste de inmediato lo editado en el archivo saliente.
      void flushSaves()
      setActivePath(path)
      setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [path, ...tabs]))
    },
    [flushSaves],
  )

  const closeTab = useCallback(
    (path: string) => {
      setOpenTabs((tabs) => {
        const next = tabs.filter((t) => t !== path)
        if (activePath === path) setActivePath(next[0] ?? '')
        return next
      })
    },
    [activePath],
  )

  const createFile = useCallback(
    async (path: string, content = '') => {
      const trimmed = path.trim().replace(/^\/+/, '')
      if (!trimmed) return
      const language = inferLanguage(trimmed)
      setBuffers((prev) => ({
        ...prev,
        [trimmed]: { content, dirty: true, language },
      }))
      setActivePath(trimmed)
      setOpenTabs((tabs) => [trimmed, ...tabs.filter((t) => t !== trimmed)])
      if (projectId) await saveFile(trimmed, content, 0)
    },
    [projectId, saveFile],
  )

  const deleteFileByPath = useCallback(
    async (path: string) => {
      if (isSpecWorkspacePath(path)) return
      setBuffers((prev) => {
        const next = { ...prev }
        delete next[path]
        return next
      })
      setOpenTabs((tabs) => tabs.filter((t) => t !== path))
      if (activePath === path) {
        const remaining = Object.keys(buffers).filter((p) => p !== path)
        setActivePath(remaining[0] ?? '')
      }
      if (projectId) await removeFile(path)
    },
    [activePath, buffers, projectId, removeFile],
  )

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      const trimNew = newPath.trim().replace(/^\/+/, '')
      if (!trimNew || trimNew === oldPath || isSpecWorkspacePath(oldPath)) return
      const language = inferLanguage(trimNew)
      const content = buffers[oldPath]?.content ?? ''
      setBuffers((prev) => {
        const next = { ...prev }
        delete next[oldPath]
        next[trimNew] = { content, dirty: true, language }
        return next
      })
      setOpenTabs((tabs) => tabs.map((t) => (t === oldPath ? trimNew : t)))
      if (activePath === oldPath) setActivePath(trimNew)
      if (projectId) {
        await saveFile(trimNew, content, 0)
        await removeFile(oldPath)
      }
    },
    [activePath, buffers, projectId, saveFile, removeFile],
  )

  const applyOps = useCallback(
    async (ops: FileOperation[], options?: { projectIdOverride?: string | null }) => {
      if (!ops.length) return { touched: [] as string[], deleted: [] as string[] }

      const effectivePid = options?.projectIdOverride ?? projectId
      let touched: string[] = []
      let deleted: string[] = []
      let nextBuffers: WorkspaceBuffers = {}

      setBuffers((prev) => {
        const cleanedOps = cleanStreamFileOps(ops, Object.keys(prev))
        const result = applyFileOperations(prev, cleanedOps)
        touched = result.touched
        deleted = result.deleted
        nextBuffers = result.buffers
        return result.buffers
      })

      buffersRef.current = nextBuffers

      if (touched.length) {
        bootstrappedRef.current = true
        if (effectivePid) bootstrappedProjectRef.current = effectivePid
        const lastTouched = touched[touched.length - 1]!
        setActivePath(lastTouched)
        setOpenTabs((tabs) => {
          const valid = tabs.filter(isValidWorkspacePath)
          const merged = [...valid]
          for (const p of touched) {
            if (!merged.includes(p)) merged.unshift(p)
          }
          return merged
        })
      }

      for (const p of deleted) {
        setOpenTabs((tabs) => tabs.filter((t) => t !== p))
      }

      if (effectivePid) {
        const toSave = touched
          .map((path) => {
            const b = nextBuffers[path]
            return b ? { path, content: b.content } : null
          })
          .filter(Boolean) as { path: string; content: string }[]
        try {
          if (toSave.length) await saveFilesBatch(toSave, effectivePid ?? undefined)
          for (const p of deleted) {
            await removeFile(p)
          }
          setBuffers((prev) => {
            const next = { ...prev }
            for (const p of touched) {
              const b = next[p]
              if (b) next[p] = { ...b, dirty: false }
            }
            return next
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'No se pudieron guardar los archivos'
          return { touched, deleted, error: msg }
        }
      }

      return { touched, deleted }
    },
    [projectId, saveFilesBatch, removeFile],
  )

  const applyStreamFiles = useCallback(
    async (incoming: { path: string; content: string }[]) => {
      if (!incoming.length) return { touched: [] as string[], deleted: [] as string[] }
      const cleaned = stripLegalBoilerplateFromFiles(migrateSpecFiles(incoming))
      const ops: FileOperation[] = cleaned.map((f) => ({
        type: 'update',
        path: f.path,
        content: f.content,
      }))
      const result = await applyOps(ops)
      const merged = fileListFromBuffers(buffersRef.current)
      const { ops: reconcileOps, wiredApp, fixedImportPaths } =
        reconcilePreviewWorkspace(merged)
      if (!reconcileOps.length) return result
      const reconciled = await applyOps(reconcileOps)
      return {
        touched: [...new Set([...(result.touched ?? []), ...(reconciled.touched ?? [])])],
        deleted: result.deleted ?? [],
        wiredApp,
        fixedImportPaths,
        error: reconciled.error ?? result.error,
      }
    },
    [applyOps],
  )

  // Escritura en vivo durante el stream del modelo: refleja el contenido
  // parcial en los buffers y enfoca el archivo que se está escribiendo,
  // sin persistir (el guardado ocurre al completar vía applyOps).
  const streamSegments = useCallback(
    (segments: ParsedSegment[], defaultPath: string) => {
      const fallback =
        defaultPath ||
        resolveStreamDefaultPath(activePath, Object.keys(buffersRef.current)) ||
        DEFAULT_PATH
      let changed = false
      setBuffers((prev) => {
        const next = { ...prev }
        const existingPaths = Object.keys(prev)
        for (const seg of segments) {
          if (seg.kind !== 'code') continue
          const path = resolveWorkspacePath(seg.path, { fallback, existingPaths })
          const cur = next[path]
          if (!shouldApplyStreamSegment(seg, cur)) continue
          if (cur && cur.content === seg.content) continue
          changed = true
          next[path] = {
            content: seg.content,
            dirty: true,
            language: cur?.language ?? inferLanguage(path),
          }
        }
        if (changed) buffersRef.current = next
        return changed ? next : prev
      })
      if (changed) bootstrappedRef.current = true
      // No cambiar pestaña/archivo activo durante el stream: evita setModel/dispose en Monaco.
    },
    [activePath],
  )

  const persistAllDirty = useCallback(async () => {
    if (!projectId) return
    const snapshot = buffersRef.current
    const dirty = fileListFromBuffers(snapshot).filter((f) => snapshot[f.path]?.dirty)
    if (!dirty.length) return
    const batch = dirty.map((f) => ({ path: f.path, content: f.content }))
    await saveFilesBatch(batch)
    setBuffers((prev) => {
      const next: WorkspaceBuffers = {}
      for (const p of Object.keys(prev)) {
        const b = prev[p]
        if (b) next[p] = { ...b, dirty: false }
      }
      return next
    })
  }, [projectId, saveFilesBatch])

  const workspaceFilesForAi = useCallback(
    () => displayFiles.map((f) => ({ path: f.path, content: f.content })),
    [displayFiles],
  )

  const reloadFromDisk = useCallback(async () => {
    bootstrappedRef.current = false
    await refresh()
  }, [refresh])

  const parseStreamOpsFromAcc = useCallback(
    (acc: string, options?: { addPreviewEntries?: boolean }) => {
      const existingPaths = Object.keys(buffersRef.current)
      const fallback =
        resolveStreamDefaultPath(activePath, existingPaths) || DEFAULT_PATH
      const raw = parseFileOperationsFromStream(acc, {
        defaultPath: fallback,
        existingPaths,
      })
      return cleanStreamFileOps(raw, existingPaths, options)
    },
    [activePath],
  )

  const parseCleanStreamOpsFromAcc = useCallback(
    (acc: string) => parseStreamOpsFromAcc(acc),
    [parseStreamOpsFromAcc],
  )

  const parseModelStreamOpsFromAcc = useCallback(
    (acc: string) => parseStreamOpsFromAcc(acc, { addPreviewEntries: false }),
    [parseStreamOpsFromAcc],
  )

  const streamOpsAlreadyApplied = useCallback((ops: FileOperation[]) => {
    return fileOpsMatchBuffers(buffersRef.current, ops)
  }, [])

  const reconcilePreviewBuffers = useCallback(async () => {
    const merged = fileListFromBuffers(buffersRef.current)
    const { ops, wiredApp, fixedImportPaths } = reconcilePreviewWorkspace(merged)
    if (!ops.length) return { wiredApp: false, fixedImportPaths: [] as string[] }
    const result = await applyOps(ops)
    return {
      wiredApp,
      fixedImportPaths,
      touched: result.touched,
      error: result.error,
    }
  }, [applyOps])

  return {
    buffers,
    displayFiles,
    activePath,
    activeContent: activeBuffer?.content ?? '',
    activeLanguage: activeBuffer?.language ?? 'typescript',
    openTabs,
    loading,
    saving,
    selectFile,
    closeTab,
    createFile,
    deleteFileByPath,
    renameFile,
    updateActiveContent,
    updateFileContent,
    applyOps,
    applyStreamFiles,
    streamSegments,
    flushSaves,
    persistAllDirty,
    persistNow,
    persistBeforeLeave,
    workspaceFilesForAi,
    refresh: reloadFromDisk,
    setBuffers,
    parseCleanStreamOpsFromAcc,
    parseModelStreamOpsFromAcc,
    streamOpsAlreadyApplied,
    reconcilePreviewBuffers,
  }
}

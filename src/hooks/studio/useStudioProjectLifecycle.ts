'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { WorkspaceBuffers } from '@/lib/ai/applyFileOperations'
import { consumeStudioForceNewProject } from '@/lib/projects/openStudio'
import {
  createStudioProject,
  saveWorkspaceToProject,
  workspaceHasMeaningfulContent,
} from '@/lib/projects/studioCommit'
import type { StudioLang } from '@/lib/projects/genericProjectName'
import type { Project } from '@/types'

export type StudioProjectMode = 'draft' | 'persisted'

type ActiveOverride = { path: string; content: string } | null

export type UseStudioProjectLifecycleOptions = {
  projectId: string | null
  draftProjectId: string | null
  setDraftProjectId: (id: string | null) => void
  studioLang: StudioLang
  router: AppRouterInstance
  buffersRef: React.RefObject<WorkspaceBuffers>
  codeRef: React.MutableRefObject<string>
  activePath: string
  specDirty: boolean
  specContent: string
  onProjectCreated?: (project: Project) => void
}

export function useStudioProjectLifecycle({
  projectId,
  draftProjectId,
  setDraftProjectId,
  studioLang,
  router,
  buffersRef,
  codeRef,
  activePath,
  specDirty,
  specContent,
  onProjectCreated,
}: UseStudioProjectLifecycleOptions) {
  const [mode, setMode] = useState<StudioProjectMode>(projectId ? 'persisted' : 'draft')
  const committedProjectIdRef = useRef<string | null>(projectId)
  const projectIdRef = useRef(projectId)
  const justCreatedProjectRef = useRef<Project | null>(null)
  const commitQueueRef = useRef<Promise<string | null>>(Promise.resolve(null))

  useEffect(() => {
    projectIdRef.current = projectId
    if (projectId) {
      setDraftProjectId(null)
      committedProjectIdRef.current = projectId
      setMode('persisted')
    } else {
      setDraftProjectId(null)
      committedProjectIdRef.current = null
      justCreatedProjectRef.current = null
      setMode('draft')
    }
  }, [projectId])

  const effectiveProjectId = projectId ?? draftProjectId

  const getActiveOverride = useCallback((): ActiveOverride => {
    return activePath ? { path: activePath, content: codeRef.current ?? '' } : null
  }, [activePath, codeRef])

  const resolveStudioProjectId = useCallback(() => {
    return (
      projectIdRef.current ??
      committedProjectIdRef.current ??
      draftProjectId ??
      null
    )
  }, [draftProjectId])

  const enqueueCommit = useCallback(
    (task: () => Promise<string | null>): Promise<string | null> => {
      const run = commitQueueRef.current.then(() => task())
      commitQueueRef.current = run.catch(() => null)
      return run
    },
    [],
  )

  const ensureProjectCommitted = useCallback(
    async (opts: { force?: boolean; initialSpec?: string } = {}): Promise<string | null> => {
      const studioFreshProject = consumeStudioForceNewProject()
      if (studioFreshProject) {
        committedProjectIdRef.current = null
        setDraftProjectId(null)
        justCreatedProjectRef.current = null
        setMode('draft')
      } else {
        const existing = resolveStudioProjectId()
        if (existing) return existing
      }

      const override = getActiveOverride()
      const spec =
        opts.initialSpec ?? (specDirty ? specContent : undefined)
      if (
        !opts.force &&
        !workspaceHasMeaningfulContent(buffersRef.current ?? {}, override, spec)
      ) {
        return null
      }

      return enqueueCommit(async () => {
        if (!studioFreshProject) {
          const again = resolveStudioProjectId()
          if (again) return again
        }

        const project = await createStudioProject(studioLang)
        committedProjectIdRef.current = project.id
        setDraftProjectId(project.id)
        setMode('persisted')
        await saveWorkspaceToProject(
          project.id,
          buffersRef.current ?? {},
          override,
          spec,
        )
        justCreatedProjectRef.current = project
        router.replace(`/studio?project=${encodeURIComponent(project.id)}`)
        onProjectCreated?.(project)
        return project.id
      })
    },
    [
      resolveStudioProjectId,
      getActiveOverride,
      specDirty,
      specContent,
      buffersRef,
      studioLang,
      router,
      onProjectCreated,
      enqueueCommit,
    ],
  )

  const recoverMissingStudioProject = useCallback(async () => {
    committedProjectIdRef.current = null
    setDraftProjectId(null)
    justCreatedProjectRef.current = null
    setMode('draft')
    return ensureProjectCommitted({ force: true })
  }, [ensureProjectCommitted])

  const clearJustCreated = useCallback((id: string) => {
    if (justCreatedProjectRef.current?.id === id) {
      justCreatedProjectRef.current = null
    }
  }, [])

  const isJustCreated = useCallback(
    (id: string) => justCreatedProjectRef.current?.id === id,
    [],
  )

  return {
    mode,
    draftProjectId,
    effectiveProjectId,
    resolveStudioProjectId,
    ensureProjectCommitted,
    recoverMissingStudioProject,
    clearJustCreated,
    isJustCreated,
    committedProjectIdRef,
  }
}

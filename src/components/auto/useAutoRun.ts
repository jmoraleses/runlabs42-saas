'use client'

import { useCallback, useState } from 'react'
import { registerDemoAutoProject } from '@/lib/auth/demo'
import { markStudioProjectJustCreated } from '@/lib/projects/openStudio'
import type { AutoRunEvent } from '@/lib/auto/types'
import type { CodeTemplate } from '@/lib/codeTemplates'

export type ArtifactsData = {
  projectId: string
  runState: Record<string, unknown> | null
  listings: Array<{
    variantId: string
    codeTemplate: string
    exportPrefix: string
    listing: Record<string, unknown> | null
    submitLog: Record<string, unknown> | null
    coverUrl: string | null
    packageUrl: string
    selectedForMarketplace: boolean
  }>
  screens: Array<{ pageId: string; previewUrl: string }>
  stitchRun: Record<string, unknown> | null
}

export type AutoRunOptions = {
  niche: string
  variantCount: number
  projectId: string
  stitchProjectId?: string
  createStitchProject: boolean
  storeTemplates: CodeTemplate[]
  selectedScreenIds: string[]
  publishToMarketplace: boolean
}

export type AutoRunStartResult = {
  projectId: string
  stitchProjectId: string | null
}

export function useAutoRun() {
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<AutoRunEvent[]>([])
  const [activePhase, setActivePhase] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<Record<string, unknown> | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadArtifacts = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/auto/projects/${projectId}/artifacts`)
    if (!res.ok) return
    setArtifacts(await res.json())
  }, [])

  const startRun = useCallback(
    async (opts: AutoRunOptions): Promise<AutoRunStartResult> => {
      setRunning(true)
      setLogs([])
      setRunResult(null)
      setArtifacts(null)
      setError(null)
      setActivePhase('stitch-connect')

      const pid = opts.projectId.trim()

      try {
        const res = await fetch('/api/auto/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stream: true,
            niche: opts.niche,
            variantCount: opts.variantCount,
            projectId: pid,
            stitchProjectId: opts.stitchProjectId,
            createStitchProject: opts.createStitchProject,
            storeTemplates: opts.storeTemplates,
            selectedScreenIds: opts.selectedScreenIds,
            publishToMarketplace: opts.publishToMarketplace,
            publishMode: 'assist',
          }),
        })

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error ?? `HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let completedState: Record<string, unknown> | null = null

        const processEvent = (part: string) => {
          const line = part.trim()
          if (!line.startsWith('data:')) return
          try {
            const ev = JSON.parse(line.slice(5).trim()) as AutoRunEvent & { state?: unknown }
            if (ev.phase === 'done' && ev.state) {
              completedState = ev.state as Record<string, unknown>
              setRunResult(completedState)
              setActivePhase('saved')
            } else if (ev.phase === 'error') {
              setError(ev.message ?? 'Error')
              setActivePhase('error')
              setLogs((prev) => [...prev, ev])
            } else if (ev.phase) {
              setActivePhase(ev.phase)
              setLogs((prev) => [...prev, ev])
            }
          } catch {
            /* ignore */
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''
          for (const part of parts) processEvent(part)
        }

        // A veces el stream termina sin delimitador final "\n\n".
        // Procesamos el remanente para no perder el evento `done`.
        buffer += decoder.decode()
        if (buffer.trim()) {
          for (const part of buffer.split('\n\n')) processEvent(part)
        }

        const finalProjectId = String(
          (completedState?.config as Record<string, unknown> | undefined)?.projectId ?? pid,
        ).trim()
        if (!finalProjectId) throw new Error('No se pudo resolver projectId del run auto')
        await loadArtifacts(finalProjectId)
        try {
          const generatedTitle = String(completedState?.projectTitle ?? '').trim()
          if (finalProjectId.startsWith('demo-')) {
            registerDemoAutoProject(
              finalProjectId,
              generatedTitle || opts.niche.slice(0, 80) || 'Auto Store',
              'html',
            )
          }
          markStudioProjectJustCreated(finalProjectId)
        } catch {
          /* demo localStorage no disponible */
        }
        const stitchedProjectId = String(
          completedState?.stitchProjectId ??
            (completedState?.config as Record<string, unknown> | undefined)?.stitchProjectId ??
            '',
        ).trim()
        return {
          projectId: finalProjectId,
          stitchProjectId: stitchedProjectId || null,
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error'
        setError(msg)
        setActivePhase('error')
        setLogs((prev) => [...prev, { phase: 'error', message: msg }])
        return { projectId: pid, stitchProjectId: null }
      } finally {
        setRunning(false)
      }
    },
    [loadArtifacts],
  )

  const confirmMarketplace = useCallback(
    async (projectId: string, variantId: string) => {
      const res = await fetch(`/api/auto/projects/${projectId}/marketplace/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      })
      if (res.ok) await loadArtifacts(projectId)
      return res.ok
    },
    [loadArtifacts],
  )

  const markMarketplaceVariant = useCallback(
    async (projectId: string, variantId: string, selected: boolean) => {
      const res = await fetch(`/api/auto/projects/${projectId}/marketplace/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, selected }),
      })
      if (res.ok) await loadArtifacts(projectId)
      return res.ok
    },
    [loadArtifacts],
  )

  return {
    running,
    logs,
    activePhase,
    runResult,
    artifacts,
    error,
    startRun,
    loadArtifacts,
    confirmMarketplace,
    markMarketplaceVariant,
  }
}

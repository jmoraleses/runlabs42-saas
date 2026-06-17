'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { normalizeProject, normalizeProjects } from '@/lib/api/projects'
import {
  createDemoProject,
  isDemoActive,
  loadDemoProjects,
  removeDemoProject,
  DEMO_EVENT,
} from '@/lib/auth/demo'
import { cleanupProjectClientState } from '@/lib/chat/cleanupProjectClientState'
import type { Project } from '@/types'

const GUEST_MODE = process.env.NEXT_PUBLIC_GUEST_MODE === '1'

function shouldUseDemoProjectsStore(): boolean {
  return GUEST_MODE || isDemoActive()
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (shouldUseDemoProjectsStore()) {
      setProjects(loadDemoProjects())
      setLoading(false)
      return
    }
    try {
      const data = await apiFetch<{ projects: unknown }>('/api/projects')
      setProjects(normalizeProjects(data.projects))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects')
      setProjects([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    if (!shouldUseDemoProjectsStore()) return
    const handler = () => setProjects(loadDemoProjects())
    window.addEventListener(DEMO_EVENT, handler)
    return () => window.removeEventListener(DEMO_EVENT, handler)
  }, [refresh])

  const create = useCallback(async (name: string, framework = 'next') => {
    if (shouldUseDemoProjectsStore()) {
      const project = createDemoProject(name, framework)
      setProjects(loadDemoProjects())
      return project
    }
    const data = await apiFetch<{ project?: unknown }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, framework }),
    })
    const project = normalizeProject(data.project)
    if (!project) {
      throw new Error('La API no devolvió el proyecto creado')
    }
    setProjects((prev) => [project, ...prev.filter((x) => x?.id)])
    return project
  }, [])

  const remove = useCallback(async (id: string) => {
    if (shouldUseDemoProjectsStore()) {
      removeDemoProject(id)
      cleanupProjectClientState(id)
      setProjects(loadDemoProjects())
      return
    }
    await apiFetch(`/api/projects/${id}`, { method: 'DELETE' })
    cleanupProjectClientState(id)
    setProjects((p) => p.filter((x) => x.id !== id))
  }, [])

  return { projects, loading, error, refresh, create, remove }
}

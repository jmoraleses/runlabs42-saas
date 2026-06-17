'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, ProjectChatSession } from '@/lib/chat/types'
import {
  createChatSession,
  deriveSessionTitle,
  loadProjectChatSessions,
  saveProjectChatSessions,
} from '@/lib/chat/projectChatStore'
import { pruneWorkspaceSnapshots } from '@/lib/chat/workspaceSnapshots'
import { apiFetch } from '@/lib/api/client'

async function cleanupSessionImages(
  projectId: string,
  sessionId: string,
  serverPersist: boolean,
) {
  try {
    if (serverPersist) {
      await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/chat/sessions/${encodeURIComponent(sessionId)}`,
        { method: 'DELETE', credentials: 'include' },
      )
    } else {
      await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
    }
  } catch {
    /* ignore */
  }
}

function messageCount(sessions: ProjectChatSession[]): number {
  return sessions.reduce((n, s) => n + s.messages.length, 0)
}

/** No pisar mensajes optimistas del primer envío si el servidor aún no los tiene. */
function mergeSessionsPreferLocal(
  prev: ProjectChatSession[],
  loaded: ProjectChatSession[],
  projectId: string,
): ProjectChatSession[] {
  const prevForProject = prev.filter((s) => s.projectId === projectId)
  if (prevForProject.length === 0) return loaded
  if (messageCount(prevForProject) > messageCount(loaded)) return prevForProject
  return loaded
}

type UseProjectChatSessionsOptions = {
  projectId: string | null
  welcomeMessage: string
  newChatLabel: string
  /** Persistir en Supabase+Blob (usuario autenticado, no demo). */
  serverPersist?: boolean
}

export function useProjectChatSessions({
  projectId,
  welcomeMessage,
  newChatLabel,
  serverPersist = false,
}: UseProjectChatSessionsOptions) {
  const [sessions, setSessions] = useState<ProjectChatSession[]>([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(false)
  const welcomeRef = useRef(welcomeMessage)
  welcomeRef.current = welcomeMessage
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistToServer = useCallback(
    async (next: ProjectChatSession[]) => {
      if (!projectId || !serverPersist) return
      for (const s of next) {
        try {
          await apiFetch(`/api/projects/${projectId}/chat/sessions/${s.id}`, {
            method: 'PUT',
            body: JSON.stringify({ session: s }),
          })
        } catch {
          /* ignore — local state sigue válido */
        }
      }
    },
    [projectId, serverPersist],
  )

  const scheduleSave = useCallback(
    (next: ProjectChatSession[]) => {
      if (!projectId) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        if (serverPersist) {
          void persistToServer(next)
        } else {
          saveProjectChatSessions(projectId, next)
        }
      }, 800)
    },
    [projectId, serverPersist, persistToServer],
  )

  useEffect(() => {
    if (!projectId) {
      setSessions([])
      setActiveId('')
      return
    }

    const pid = projectId
    let cancelled = false

    async function load() {
      setLoading(true)
      if (serverPersist) {
        try {
          const data = await apiFetch<{ sessions: ProjectChatSession[] }>(
            `/api/projects/${pid}/chat/sessions`,
          )
          if (cancelled) return
          const loaded = data.sessions ?? []
          if (loaded.length === 0) {
            const created = await apiFetch<{ session: ProjectChatSession }>(
              `/api/projects/${pid}/chat/sessions`,
              { method: 'POST', body: JSON.stringify({ title: newChatLabel }) },
            )
            if (cancelled) return
            setSessions((prev) => mergeSessionsPreferLocal(prev, [created.session], pid))
            setActiveId((id) => id || created.session.id)
          } else {
            setSessions((prev) => mergeSessionsPreferLocal(prev, loaded, pid))
            setActiveId((id) => {
              if (id && loaded.some((s) => s.id === id)) return id
              return loaded[0]?.id ?? id
            })
          }
        } catch {
          const local = loadProjectChatSessions(pid)
          if (!cancelled) {
            if (local.length === 0) {
              const first = createChatSession(pid, welcomeRef.current, newChatLabel)
              setSessions((prev) => mergeSessionsPreferLocal(prev, [first], pid))
              setActiveId((id) => id || first.id)
            } else {
              setSessions((prev) => mergeSessionsPreferLocal(prev, local, pid))
              setActiveId((id) => id || (local[0]?.id ?? ''))
            }
          }
        }
      } else {
        const loaded = loadProjectChatSessions(pid)
        if (cancelled) return
        if (loaded.length === 0) {
          const first = createChatSession(pid, welcomeRef.current, newChatLabel)
          setSessions((prev) => mergeSessionsPreferLocal(prev, [first], pid))
          setActiveId((id) => id || first.id)
        } else {
          setSessions((prev) => mergeSessionsPreferLocal(prev, loaded, pid))
          setActiveId((id) => id || (loaded[0]?.id ?? ''))
        }
      }
      if (!cancelled) setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [projectId, newChatLabel, serverPersist])

  useEffect(() => {
    const first = sessions[0]
    if (!first) return
    if (!activeId || !sessions.some((s) => s.id === activeId)) {
      setActiveId(first.id)
    }
  }, [sessions, activeId])

  const activeSession = sessions.find((s) => s.id === activeId) ?? null

  /** Resuelve la sesión activa; crea una local si aún no hay ninguna (p. ej. primer mensaje). */
  const resolveActiveSessionId = useCallback(
    (prev: ProjectChatSession[]): { sessions: ProjectChatSession[]; targetId: string } | null => {
      if (!projectId) return null

      if (activeId && prev.some((s) => s.id === activeId)) {
        return { sessions: prev, targetId: activeId }
      }
      if (prev.length > 0) {
        return { sessions: prev, targetId: prev[0]!.id }
      }

      const created = createChatSession(projectId, welcomeRef.current, newChatLabel)
      return { sessions: [created], targetId: created.id }
    },
    [activeId, newChatLabel, projectId],
  )

  const setActiveMessages = useCallback(
    (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      if (!projectId) return
      setSessions((prev) => {
        const resolved = resolveActiveSessionId(prev)
        if (!resolved) return prev

        const { sessions: base, targetId } = resolved
        if (targetId !== activeId) {
          queueMicrotask(() => setActiveId(targetId))
        }

        const next = base.map((s) => {
          if (s.id !== targetId) return s
          const messages = typeof update === 'function' ? update(s.messages) : update
          const title = deriveSessionTitle(messages, s.title || newChatLabel)
          return {
            ...s,
            messages,
            title,
            updatedAt: new Date().toISOString(),
          }
        })
        scheduleSave(next)
        return next
      })
    },
    [activeId, newChatLabel, projectId, scheduleSave, resolveActiveSessionId],
  )

  const ensureActiveChatSession = useCallback(async (): Promise<string | null> => {
    if (!projectId) return null

    if (activeId && sessions.some((s) => s.id === activeId)) return activeId
    if (sessions.length > 0) {
      const id = sessions[0]!.id
      setActiveId(id)
      return id
    }

    if (serverPersist) {
      try {
        const data = await apiFetch<{ session: ProjectChatSession }>(
          `/api/projects/${projectId}/chat/sessions`,
          { method: 'POST', body: JSON.stringify({ title: newChatLabel }) },
        )
        setSessions((prev) => [...prev, data.session])
        setActiveId(data.session.id)
        return data.session.id
      } catch {
        return null
      }
    }

    const session = createChatSession(projectId, welcomeRef.current, newChatLabel)
    setSessions([session])
    setActiveId(session.id)
    scheduleSave([session])
    return session.id
  }, [activeId, sessions, projectId, newChatLabel, serverPersist, scheduleSave])

  const createSession = useCallback(async () => {
    if (!projectId) return null
    if (serverPersist) {
      try {
        const data = await apiFetch<{ session: ProjectChatSession }>(
          `/api/projects/${projectId}/chat/sessions`,
          { method: 'POST', body: JSON.stringify({ title: newChatLabel }) },
        )
        setSessions((prev) => [...prev, data.session])
        setActiveId(data.session.id)
        return data.session
      } catch {
        return null
      }
    }
    const session = createChatSession(projectId, welcomeRef.current, newChatLabel)
    setSessions((prev) => {
      const next = [...prev, session]
      scheduleSave(next)
      return next
    })
    setActiveId(session.id)
    return session
  }, [projectId, newChatLabel, serverPersist, scheduleSave])

  const selectSession = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const closeSession = useCallback(
    async (id: string) => {
      if (projectId) void cleanupSessionImages(projectId, id, serverPersist)
      setSessions((prev) => {
        const closing = prev.find((s) => s.id === id)
        if (closing && projectId) {
          const snapIds = closing.messages
            .map((m) => m.workspaceSnapshotId)
            .filter((sid): sid is string => Boolean(sid))
          pruneWorkspaceSnapshots(projectId, snapIds)
        }
        let next = prev.filter((s) => s.id !== id)
        if (next.length === 0 && projectId) {
          if (serverPersist) {
            void (async () => {
              try {
                const data = await apiFetch<{ session: ProjectChatSession }>(
                  `/api/projects/${projectId}/chat/sessions`,
                  { method: 'POST', body: JSON.stringify({ title: newChatLabel }) },
                )
                setSessions([data.session])
                setActiveId(data.session.id)
              } catch {
                const fallback = createChatSession(projectId, welcomeRef.current, newChatLabel)
                setSessions([fallback])
                setActiveId(fallback.id)
              }
            })()
            return prev
          }
          next = [createChatSession(projectId, welcomeRef.current, newChatLabel)]
        }
        scheduleSave(next)
        return next
      })
    },
    [projectId, newChatLabel, serverPersist, scheduleSave],
  )

  const updateWelcomeForEmptySessions = useCallback((message: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.messages.length === 1 && s.messages[0]?.role === 'assistant') {
          return {
            ...s,
            messages: [{ role: 'assistant', content: message }],
            updatedAt: new Date().toISOString(),
          }
        }
        return s
      }),
    )
  }, [])

  return {
    sessions,
    activeSession,
    activeId,
    activeMessages: activeSession?.messages ?? [],
    setActiveMessages,
    ensureActiveChatSession,
    createSession,
    selectSession,
    closeSession,
    updateWelcomeForEmptySessions,
    chatLoading: loading,
  }
}

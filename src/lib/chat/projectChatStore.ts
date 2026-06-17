'use client'

import type { ChatAppliedFile, ChatMessage, ProjectChatSession } from '@/lib/chat/types'

const STORAGE_KEY = 'runlabs_project_chat_sessions'

const MAX_PROJECTS = 12
const MAX_SESSIONS_PER_PROJECT = 15
const MAX_MESSAGES_PER_SESSION = 40
const MAX_USER_MESSAGE_CHARS = 8_000
const MAX_ASSISTANT_MESSAGE_CHARS = 10_000

type StoreShape = Record<string, ProjectChatSession[]>

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; code?: number }
  return (
    e.name === 'QuotaExceededError' ||
    e.code === 22 ||
    e.code === 1014 ||
    /quota/i.test(String(err))
  )
}

function readAll(): StoreShape {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoreShape) : {}
  } catch {
    return {}
  }
}

function compactAppliedFiles(files?: ChatAppliedFile[]): ChatAppliedFile[] | undefined {
  if (!files?.length) return undefined
  return files.slice(0, 32).map((f) => ({
    path: f.path,
    action: f.action,
    lines: f.lines,
    sizeBytes: f.sizeBytes,
  }))
}

/** Recorta mensajes largos (p. ej. respuestas con muchos bloques de código). */
function compactMessage(m: ChatMessage): ChatMessage {
  const role = m.role === 'user' ? 'user' : 'assistant'
  const raw = String(m.content ?? '')
  const max =
    role === 'assistant' ? MAX_ASSISTANT_MESSAGE_CHARS : MAX_USER_MESSAGE_CHARS
  const content =
    raw.length > max
      ? `${raw.slice(0, max)}\n\n… [mensaje recortado al guardar en el navegador]`
      : raw

  return {
    role,
    content,
    workspaceSnapshotId:
      role === 'user' && m.workspaceSnapshotId
        ? String(m.workspaceSnapshotId)
        : undefined,
    appliedFiles: compactAppliedFiles(m.appliedFiles),
    studioEvent: m.studioEvent,
    chatInsight: m.chatInsight,
    contextPaths: m.contextPaths?.slice(0, 24),
    visualEdit: m.visualEdit,
  }
}

function compactSession(session: ProjectChatSession): ProjectChatSession {
  const messages = sanitizeMessages(session.messages)
    .slice(-MAX_MESSAGES_PER_SESSION)
    .map(compactMessage)
  return {
    ...session,
    title: String(session.title ?? '').slice(0, 120),
    messages,
  }
}

function projectLastUpdated(sessions: ProjectChatSession[]): number {
  let t = 0
  for (const s of sessions) {
    const u = Date.parse(s.updatedAt || s.createdAt || '') || 0
    if (u > t) t = u
  }
  return t
}

/** Limita proyectos y sesiones; prioriza el proyecto activo. */
function pruneStore(all: StoreShape, priorityProjectId?: string): StoreShape {
  const entries = Object.entries(all).map(([pid, sessions]) => ({
    pid,
    sessions: sessions
      .slice()
      .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0))
      .slice(0, MAX_SESSIONS_PER_PROJECT)
      .map(compactSession),
    updated: projectLastUpdated(sessions),
  }))

  entries.sort((a, b) => {
    if (priorityProjectId) {
      if (a.pid === priorityProjectId) return -1
      if (b.pid === priorityProjectId) return 1
    }
    return b.updated - a.updated
  })

  const kept = entries.slice(0, MAX_PROJECTS)
  const out: StoreShape = {}
  for (const { pid, sessions } of kept) {
    if (sessions.length) out[pid] = sessions
  }
  return out
}

function aggressivePrune(all: StoreShape, priorityProjectId: string | undefined, pass: number): StoreShape {
  if (pass === 0) {
    const next: StoreShape = {}
    for (const [pid, sessions] of Object.entries(all)) {
      next[pid] = sessions.map((s) => ({
        ...s,
        messages: compactSession(s).messages.slice(-Math.max(12, Math.floor(MAX_MESSAGES_PER_SESSION / 2))),
      }))
    }
    return pruneStore(next, priorityProjectId)
  }
  if (pass === 1) {
    const next: StoreShape = {}
    for (const [pid, sessions] of Object.entries(all)) {
      next[pid] = sessions.slice(0, 5).map((s) => ({
        ...compactSession(s),
        messages: s.messages.slice(-8),
      }))
    }
    return priorityProjectId && next[priorityProjectId]
      ? { [priorityProjectId]: next[priorityProjectId] }
      : next
  }
  if (priorityProjectId && all[priorityProjectId]?.length) {
    const s = all[priorityProjectId][0]
    if (!s) return {}
    return {
      [priorityProjectId]: [
        {
          ...compactSession(s),
          messages: s.messages.slice(-4),
        },
      ],
    }
  }
  const first = Object.entries(all)[0]
  if (!first) return {}
  const [pid, sessions] = first
  const s = sessions[0]
  if (!s) return {}
  return {
    [pid]: [{ ...compactSession(s), messages: s.messages.slice(-2) }],
  }
}

function writeAll(data: StoreShape, priorityProjectId?: string): boolean {
  if (typeof window === 'undefined') return false
  let payload = pruneStore(data, priorityProjectId)
  for (let pass = 0; pass < 4; pass++) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      return true
    } catch (err) {
      if (!isQuotaError(err)) return false
      payload = aggressivePrune(payload, priorityProjectId, pass)
    }
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    if (priorityProjectId && data[priorityProjectId]?.length) {
      const minimal = {
        [priorityProjectId]: data[priorityProjectId].slice(0, 1).map((s) => ({
          ...s,
          messages: s.messages.slice(-2).map(compactMessage),
        })),
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal))
      return true
    }
  } catch {
    /* sin espacio */
  }
  return false
}

export function loadProjectChatSessions(projectId: string): ProjectChatSession[] {
  const list = readAll()[projectId] ?? []
  return list.map((s) => ({
    ...s,
    messages: sanitizeMessages(s.messages),
  }))
}

export function saveProjectChatSessions(projectId: string, sessions: ProjectChatSession[]): boolean {
  const all = readAll()
  all[projectId] = sessions.map(compactSession)
  return writeAll(all, projectId)
}

export function removeProjectChatSessions(projectId: string) {
  const all = readAll()
  delete all[projectId]
  writeAll(all)
}

/** No persistir blob: URLs locales caducan al recargar. */
function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(messages)) return []
  return messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content ?? ''),
    images: undefined,
    workspaceSnapshotId:
      m.role === 'user' && m.workspaceSnapshotId
        ? String(m.workspaceSnapshotId)
        : undefined,
    appliedFiles: compactAppliedFiles(m.appliedFiles),
    studioEvent: m.studioEvent,
    chatInsight: m.chatInsight,
    contextPaths: m.contextPaths,
    visualEdit: m.visualEdit,
  }))
}

export function createChatSession(
  projectId: string,
  _welcomeMessage: string,
  title?: string,
): ProjectChatSession {
  const now = new Date().toISOString()
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return {
    id,
    projectId,
    title: title ?? '',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function deriveSessionTitle(messages: ChatMessage[], fallback: string): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.content.trim())
  if (!firstUser) return fallback
  const text = firstUser.content.trim().replace(/\s+/g, ' ')
  return text.length > 28 ? `${text.slice(0, 28)}…` : text
}

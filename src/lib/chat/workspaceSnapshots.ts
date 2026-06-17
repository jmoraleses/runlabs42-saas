'use client'

export type WorkspaceSnapshot = {
  files: { path: string; content: string }[]
  spec: string
  capturedAt: string
}

const STORAGE_KEY = 'runlabs_project_workspace_snapshots'
const MAX_SNAPSHOTS_PER_PROJECT = 6
const MAX_PROJECTS_WITH_SNAPSHOTS = 8

type StoreShape = Record<string, Record<string, WorkspaceSnapshot>>

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

function pruneSnapshots(all: StoreShape, priorityProjectId?: string): StoreShape {
  const projectEntries = Object.entries(all).map(([pid, bucket]) => {
    const snaps = Object.entries(bucket)
      .sort(
        (a, b) =>
          (Date.parse(b[1].capturedAt) || 0) - (Date.parse(a[1].capturedAt) || 0),
      )
      .slice(0, MAX_SNAPSHOTS_PER_PROJECT)
    return { pid, bucket: Object.fromEntries(snaps), updated: snaps[0]?.[1].capturedAt ?? '' }
  })
  projectEntries.sort((a, b) => {
    if (priorityProjectId) {
      if (a.pid === priorityProjectId) return -1
      if (b.pid === priorityProjectId) return 1
    }
    return (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0)
  })
  const out: StoreShape = {}
  for (const { pid, bucket } of projectEntries.slice(0, MAX_PROJECTS_WITH_SNAPSHOTS)) {
    if (Object.keys(bucket).length) out[pid] = bucket
  }
  return out
}

function writeAll(data: StoreShape, priorityProjectId?: string): boolean {
  if (typeof window === 'undefined') return false
  let payload = pruneSnapshots(data, priorityProjectId)
  for (let pass = 0; pass < 3; pass++) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      return true
    } catch (err) {
      if (!isQuotaError(err)) return false
      if (pass === 0) {
        const lighter: StoreShape = {}
        for (const [pid, bucket] of Object.entries(payload)) {
          const entries = Object.entries(bucket).slice(0, 3)
          lighter[pid] = Object.fromEntries(entries)
        }
        payload = lighter
        continue
      }
      if (pass === 1 && priorityProjectId && payload[priorityProjectId]) {
        const latest = Object.entries(payload[priorityProjectId]).sort(
          (a, b) =>
            (Date.parse(b[1].capturedAt) || 0) - (Date.parse(a[1].capturedAt) || 0),
        )[0]
        payload = latest
          ? { [priorityProjectId]: { [latest[0]]: latest[1] } }
          : {}
        continue
      }
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
      return false
    }
  }
  return false
}

export function saveWorkspaceSnapshot(
  projectId: string,
  payload: { files: { path: string; content: string }[]; spec?: string },
): string | null {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `snap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const snapshot: WorkspaceSnapshot = {
    files: payload.files.map((f) => ({ path: f.path, content: f.content })),
    spec: payload.spec ?? '',
    capturedAt: new Date().toISOString(),
  }
  const all = readAll()
  if (!all[projectId]) all[projectId] = {}
  all[projectId][id] = snapshot
  return writeAll(pruneSnapshots(all, projectId), projectId) ? id : null
}

export function loadWorkspaceSnapshot(
  projectId: string,
  snapshotId: string,
): WorkspaceSnapshot | null {
  return readAll()[projectId]?.[snapshotId] ?? null
}

export function pruneWorkspaceSnapshots(projectId: string, snapshotIds: string[]) {
  if (!snapshotIds.length) return
  const all = readAll()
  const bucket = all[projectId]
  if (!bucket) return
  for (const id of snapshotIds) delete bucket[id]
  if (Object.keys(bucket).length === 0) delete all[projectId]
  else all[projectId] = bucket
  writeAll(all, projectId)
}

export function removeAllWorkspaceSnapshots(projectId: string) {
  const all = readAll()
  if (all[projectId]) {
    delete all[projectId]
    writeAll(all, projectId)
  }
}

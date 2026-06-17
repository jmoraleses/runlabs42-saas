import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'

export type LocalMemoryRow = {
  id: string
  category: string
  content: string
  created_at: string
  updated_at: string
  project_id?: string
}

const ROOT = path.join(process.cwd(), '.data', 'local-memories')
const USER_FILE = path.join(ROOT, 'user.json')
const PROJECTS_DIR = path.join(ROOT, 'projects')

export function isLocalMemoryDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

function safeProjectFilename(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function projectFile(projectId: string): string {
  return path.join(PROJECTS_DIR, `${safeProjectFilename(projectId)}.json`)
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

async function readJsonFile(filePath: string): Promise<LocalMemoryRow[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is LocalMemoryRow =>
        r &&
        typeof r === 'object' &&
        typeof (r as LocalMemoryRow).id === 'string' &&
        typeof (r as LocalMemoryRow).content === 'string',
    )
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

async function writeJsonFile(filePath: string, rows: LocalMemoryRow[]) {
  await ensureDir(path.dirname(filePath))
  const tmp = `${filePath}.${process.pid}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
  await fs.rename(tmp, filePath)
}

export async function listLocalUserMemories(limit = 50): Promise<LocalMemoryRow[]> {
  const rows = await readJsonFile(USER_FILE)
  return rows
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit)
}

export async function listLocalProjectMemories(
  projectId: string,
  limit = 50,
): Promise<LocalMemoryRow[]> {
  const rows = await readJsonFile(projectFile(projectId))
  return rows
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit)
    .map((r) => ({ ...r, project_id: projectId }))
}

export async function insertLocalMemories(
  scope: 'user' | 'project',
  projectId: string | null,
  items: { category: string; content: string }[],
): Promise<void> {
  if (!items.length) return
  const now = new Date().toISOString()
  if (scope === 'user') {
    const rows = await readJsonFile(USER_FILE)
    for (const item of items) {
      rows.push({
        id: randomUUID(),
        category: item.category,
        content: item.content.slice(0, 500),
        created_at: now,
        updated_at: now,
      })
    }
    await writeJsonFile(USER_FILE, rows)
    return
  }
  if (!projectId) return
  const file = projectFile(projectId)
  const rows = await readJsonFile(file)
  for (const item of items) {
    rows.push({
      id: randomUUID(),
      category: item.category,
      content: item.content.slice(0, 500),
      created_at: now,
      updated_at: now,
      project_id: projectId,
    })
  }
  await writeJsonFile(file, rows)
}

export async function updateLocalMemory(
  id: string,
  scope: 'user' | 'project',
  projectId: string | null,
  patch: { content?: string; category?: string },
): Promise<boolean> {
  const file = scope === 'project' && projectId ? projectFile(projectId) : USER_FILE
  const rows = await readJsonFile(file)
  const idx = rows.findIndex((r) => r.id === id)
  if (idx < 0) return false
  const now = new Date().toISOString()
  rows[idx] = {
    ...rows[idx]!,
    ...(patch.content !== undefined ? { content: patch.content } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    updated_at: now,
  }
  await writeJsonFile(file, rows)
  return true
}

export async function deleteLocalMemory(
  id: string,
  scope: 'user' | 'project',
  projectId: string | null,
): Promise<boolean> {
  const file = scope === 'project' && projectId ? projectFile(projectId) : USER_FILE
  const rows = await readJsonFile(file)
  const next = rows.filter((r) => r.id !== id)
  if (next.length === rows.length) return false
  await writeJsonFile(file, next)
  return true
}

/** Borra el archivo de memoria de proyecto en desarrollo local. */
export async function deleteLocalProjectMemories(projectId: string): Promise<void> {
  if (!isLocalMemoryDev()) return
  try {
    await fs.unlink(projectFile(projectId))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
}

const MAX_USER = 12
const MAX_PROJECT = 16
const MAX_CHARS = 400

function truncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** Bloque de contexto para el stream en modo local/demo. */
export async function buildLocalMemoryContextBlock(projectId?: string): Promise<string> {
  const lines: string[] = []
  const userRows = await listLocalUserMemories(MAX_USER)
  if (userRows.length) {
    lines.push('', '## Preferencias del usuario (memoria persistente)', '')
    for (const row of userRows) {
      lines.push(`- [${row.category}] ${truncate(row.content, MAX_CHARS)}`)
    }
  }
  if (projectId) {
    const projectRows = await listLocalProjectMemories(projectId, MAX_PROJECT)
    if (projectRows.length) {
      lines.push('', '## Contexto del proyecto (memoria persistente)', '')
      for (const row of projectRows) {
        lines.push(`- [${row.category}] ${truncate(row.content, MAX_CHARS)}`)
      }
    }
  }
  if (!lines.length) return ''
  lines.push('', 'Usa esta memoria para personalizar respuestas sin repetirla literalmente al usuario.')
  return lines.join('\n')
}

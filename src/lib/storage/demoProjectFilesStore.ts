import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { del, list, put } from '@vercel/blob'
import { ApiError } from '@/lib/api/errors'
import { inferLanguage } from '@/lib/projects/access'
import {
  demoProjectFileBlobPath,
  demoProjectManifestBlobPath,
  demoProjectsPrefix,
} from './blobPaths'
import { blobToken, isBlobStorageEnabled } from './config'
import { purgeBlobPrefix } from './purgeBlobs'

export type DemoProjectFileRecord = {
  id: string
  projectId: string
  path: string
  content: string
  language: string | null
  updatedAt: string
  storageKey: string | null
  sizeBytes: number
}

type ManifestEntry = {
  id: string
  path: string
  language: string | null
  updatedAt: string
  storageKey: string | null
  sizeBytes: number
}

type ProjectManifest = {
  projectId: string
  files: ManifestEntry[]
}

const FS_ROOT = path.join(process.cwd(), '.data', 'local-projects')

/** Serializa lecturas/escrituras del manifest en dev (evita ENOENT por rename concurrente). */
const fsManifestLocks = new Map<string, Promise<unknown>>()

function withFsManifestLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const prev = fsManifestLocks.get(projectId) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  fsManifestLocks.set(projectId, next)
  return next.finally(() => {
    if (fsManifestLocks.get(projectId) === next) fsManifestLocks.delete(projectId)
  })
}

export function isDemoFilesystemBackend(): boolean {
  const forced = process.env.DEMO_FILES_BACKEND?.trim().toLowerCase()
  if (forced === 'fs') return true
  if (forced === 'blob') return false
  // En `next dev` usar siempre disco local (evita Blob sin token y manifiestos vacíos).
  return process.env.NODE_ENV !== 'production'
}

function safeProjectDir(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function projectRoot(projectId: string): string {
  return path.join(FS_ROOT, safeProjectDir(projectId))
}

export function normalizeDemoProjectFilePath(filePath: string): string {
  return filePath.replace(/^\/+/, '').replace(/\\/g, '/')
}

function resolveContentPath(projectDir: string, filePath: string): string {
  const normalized = normalizeDemoProjectFilePath(filePath).replace(/\.\./g, '')
  const full = path.join(projectDir, 'files', normalized)
  const rel = path.relative(path.join(projectDir, 'files'), full)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new ApiError(400, 'Ruta de archivo no válida')
  }
  return full
}

function mapEntry(projectId: string, entry: ManifestEntry, content: string): DemoProjectFileRecord {
  return {
    id: entry.id,
    projectId,
    path: entry.path,
    content,
    language: entry.language,
    updatedAt: entry.updatedAt,
    storageKey: entry.storageKey,
    sizeBytes: entry.sizeBytes,
  }
}

async function readFsManifest(projectId: string): Promise<ProjectManifest> {
  const manifestPath = path.join(projectRoot(projectId), 'manifest.json')
  try {
    const raw = await fs.readFile(manifestPath, 'utf8')
    const parsed = JSON.parse(raw) as ProjectManifest
    if (parsed?.projectId === projectId && Array.isArray(parsed.files)) return parsed
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
  return { projectId, files: [] }
}

async function writeFsManifest(manifest: ProjectManifest): Promise<void> {
  const root = projectRoot(manifest.projectId)
  await fs.mkdir(root, { recursive: true })
  const tmp = path.join(root, `manifest.${randomUUID()}.tmp`)
  const dest = path.join(root, 'manifest.json')
  await fs.writeFile(tmp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await fs.rename(tmp, dest)
}

async function fetchBlobText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new ApiError(500, `No se pudo leer el archivo (${res.status})`)
  return res.text()
}

async function readBlobManifest(projectId: string): Promise<ProjectManifest> {
  if (!isBlobStorageEnabled()) return { projectId, files: [] }
  const pathname = demoProjectManifestBlobPath(projectId)
  try {
    const result = await list({ prefix: pathname, token: blobToken(), limit: 10 })
    const blob = result.blobs.find((b) => b.pathname === pathname)
    if (!blob) return { projectId, files: [] }
    const raw = await fetchBlobText(blob.url)
    const parsed = JSON.parse(raw) as ProjectManifest
    if (parsed?.projectId === projectId && Array.isArray(parsed.files)) return parsed
  } catch {
    /* manifest aún no existe */
  }
  return { projectId, files: [] }
}

async function writeBlobManifest(manifest: ProjectManifest): Promise<void> {
  if (!isBlobStorageEnabled()) {
    throw new ApiError(503, 'BLOB_READ_WRITE_TOKEN no configurado')
  }
  const pathname = demoProjectManifestBlobPath(manifest.projectId)
  await put(pathname, JSON.stringify(manifest), {
    access: 'public',
    token: blobToken(),
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export class DemoProjectFilesStore {
  constructor(private projectId: string) {}

  private get fsMode() {
    return isDemoFilesystemBackend()
  }

  private async readManifest(): Promise<ProjectManifest> {
    return this.fsMode ? readFsManifest(this.projectId) : readBlobManifest(this.projectId)
  }

  private async writeManifest(manifest: ProjectManifest): Promise<void> {
    if (this.fsMode) await writeFsManifest(manifest)
    else await writeBlobManifest(manifest)
  }

  /** Listado ligero (solo manifiesto) — evita leer PNGs de varios MB en cada refresh. */
  async listMeta(): Promise<DemoProjectFileRecord[]> {
    const manifest = await this.readManifest()
    return manifest.files
      .map((entry) => mapEntry(this.projectId, entry, ''))
      .sort((a, b) => a.path.localeCompare(b.path))
  }

  async list(): Promise<DemoProjectFileRecord[]> {
    const manifest = await this.readManifest()
    const out: DemoProjectFileRecord[] = []
    for (const entry of manifest.files) {
      out.push(mapEntry(this.projectId, entry, await this.readContent(entry)))
    }
    return out.sort((a, b) => a.path.localeCompare(b.path))
  }

  async get(filePath: string): Promise<DemoProjectFileRecord | null> {
    const normalized = normalizeDemoProjectFilePath(filePath)
    const manifest = await this.readManifest()
    const entry = manifest.files.find((f) => f.path === normalized)
    if (!entry) return null
    return mapEntry(this.projectId, entry, await this.readContent(entry))
  }

  private async writeFileContent(
    normalized: string,
    content: string,
    entry: ManifestEntry | undefined,
  ): Promise<string | null> {
    if (this.fsMode) {
      const root = projectRoot(this.projectId)
      const full = resolveContentPath(root, normalized)
      await fs.mkdir(path.dirname(full), { recursive: true })
      await fs.writeFile(full, content, 'utf8')
      return null
    }
    if (isBlobStorageEnabled()) {
      const pathname = demoProjectFileBlobPath(this.projectId, normalized)
      const blob = await put(pathname, content, {
        access: 'public',
        token: blobToken(),
        contentType: 'text/plain; charset=utf-8',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      if (!blob.url) throw new ApiError(503, 'Blob put devolvió URL vacía')
      if (entry?.storageKey && entry.storageKey !== blob.url) {
        await del(entry.storageKey, { token: blobToken() }).catch(() => undefined)
      }
      return blob.url
    }
    throw new ApiError(503, 'Almacenamiento no disponible')
  }

  async put(filePath: string, content: string, language?: string | null): Promise<DemoProjectFileRecord> {
    const normalized = normalizeDemoProjectFilePath(filePath)
    if (!normalized) throw new ApiError(400, 'Ruta vacía')

    const run = async () => {
      const manifest = await this.readManifest()
      const now = new Date().toISOString()
      const sizeBytes = Buffer.byteLength(content, 'utf8')
      const lang = language ?? inferLanguage(normalized)
      let entry = manifest.files.find((f) => f.path === normalized)
      const storageKey = await this.writeFileContent(normalized, content, entry)

      if (entry) {
        entry.language = lang
        entry.updatedAt = now
        entry.sizeBytes = sizeBytes
        entry.storageKey = storageKey
      } else {
        entry = {
          id: randomUUID(),
          path: normalized,
          language: lang,
          updatedAt: now,
          storageKey,
          sizeBytes,
        }
        manifest.files.push(entry)
      }

      await this.writeManifest(manifest)
      return mapEntry(this.projectId, entry, content)
    }

    return this.fsMode ? withFsManifestLock(this.projectId, run) : run()
  }

  async putMany(
    files: { path: string; content: string; language?: string | null }[],
  ): Promise<DemoProjectFileRecord[]> {
    const batch = files.filter((f) => f.path.trim())
    if (!batch.length) return []

    const run = async () => {
      const manifest = await this.readManifest()
      const now = new Date().toISOString()
      const out: DemoProjectFileRecord[] = []

      for (const f of batch) {
        const normalized = normalizeDemoProjectFilePath(f.path)
        const content = String(f.content ?? '')
        const sizeBytes = Buffer.byteLength(content, 'utf8')
        const lang = f.language ?? inferLanguage(normalized)
        let entry = manifest.files.find((x) => x.path === normalized)
        const storageKey = await this.writeFileContent(normalized, content, entry)

        if (entry) {
          entry.language = lang
          entry.updatedAt = now
          entry.sizeBytes = sizeBytes
          entry.storageKey = storageKey
        } else {
          entry = {
            id: randomUUID(),
            path: normalized,
            language: lang,
            updatedAt: now,
            storageKey,
            sizeBytes,
          }
          manifest.files.push(entry)
        }
        out.push(mapEntry(this.projectId, entry, content))
      }

      await this.writeManifest(manifest)
      return out
    }

    return this.fsMode ? withFsManifestLock(this.projectId, run) : run()
  }

  async delete(filePath: string): Promise<void> {
    const normalized = normalizeDemoProjectFilePath(filePath)
    const run = async () => {
      const manifest = await this.readManifest()
      const entry = manifest.files.find((f) => f.path === normalized)
      if (!entry) return

      if (this.fsMode) {
        const root = projectRoot(this.projectId)
        try {
          await fs.unlink(resolveContentPath(root, normalized))
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
        }
      } else if (entry.storageKey && isBlobStorageEnabled()) {
        await del(entry.storageKey, { token: blobToken() }).catch(() => undefined)
      }

      manifest.files = manifest.files.filter((f) => f.path !== normalized)
      await this.writeManifest(manifest)
    }

    return this.fsMode ? withFsManifestLock(this.projectId, run) : run()
  }

  private async readContent(entry: ManifestEntry): Promise<string> {
    if (this.fsMode) {
      const root = projectRoot(this.projectId)
      try {
        return await fs.readFile(resolveContentPath(root, entry.path), 'utf8')
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return ''
        throw e
      }
    }
    if (entry.storageKey) {
      try {
        return await fetchBlobText(entry.storageKey)
      } catch {
        return ''
      }
    }
    return ''
  }
}

export function getDemoProjectFilesStore(projectId: string): DemoProjectFilesStore {
  return new DemoProjectFilesStore(projectId)
}

/** Elimina por completo el almacenamiento de un proyecto demo (filesystem o Blob). */
export async function deleteDemoProjectStorage(projectId: string): Promise<void> {
  if (isDemoFilesystemBackend()) {
    try {
      await fs.rm(projectRoot(projectId), { recursive: true, force: true })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }
    return
  }
  await purgeBlobPrefix(demoProjectsPrefix(projectId))
}

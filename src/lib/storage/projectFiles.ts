import type { SupabaseClient } from '@supabase/supabase-js'
import { del, put } from '@vercel/blob'
import { ApiError } from '@/lib/api/errors'
import { inferLanguage } from '@/lib/projects/access'
import { projectFileBlobPath } from './blobPaths'
import { blobToken, INLINE_CONTENT_MAX_BYTES, isBlobStorageEnabled } from './config'
import { adjustQuota, checkQuotaForUpload } from './quota'

export type ProjectFileRecord = {
  id: string
  projectId: string
  path: string
  content: string
  language: string | null
  updatedAt: string
  storageKey: string | null
  sizeBytes: number
}

function mapRow(row: Record<string, unknown>): ProjectFileRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    path: String(row.path),
    content: String(row.content ?? ''),
    language: row.language ? String(row.language) : null,
    updatedAt: String(row.updated_at),
    storageKey: row.storage_key ? String(row.storage_key) : null,
    sizeBytes: Number(row.size_bytes ?? 0),
  }
}

export class ProjectFilesStore {
  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    private projectId: string,
  ) {}

  /** Rutas y metadatos sin cargar blobs (p. ej. mockups PNG grandes). */
  async listMeta(): Promise<ProjectFileRecord[]> {
    const { data, error } = await this.supabase
      .from('project_files')
      .select('id, project_id, path, language, updated_at, storage_key, size_bytes')
      .eq('project_id', this.projectId)
      .order('path', { ascending: true })

    if (error) throw new ApiError(500, error.message)

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      ...mapRow(row),
      content: '',
    }))
  }

  async list(): Promise<ProjectFileRecord[]> {
    const { data, error } = await this.supabase
      .from('project_files')
      .select('*')
      .eq('project_id', this.projectId)
      .order('path', { ascending: true })

    if (error) throw new ApiError(500, error.message)

    const rows = (data ?? []) as Record<string, unknown>[]
    const out: ProjectFileRecord[] = []

    for (const row of rows) {
      const mapped = mapRow(row)
      // Always try to fetch from Blob if storageKey exists (URLs are public)
      if (mapped.storageKey) {
        try {
          mapped.content = await this.fetchBlobContent(mapped.storageKey)
        } catch (e) {
          // If Blob storage is disabled or URL invalid, keep empty content
          console.warn(`[Blob fetch skipped] ${mapped.path}:`, e instanceof Error ? e.message : String(e))
        }
      }
      out.push(mapped)
    }
    return out
  }

  async get(path: string): Promise<ProjectFileRecord | null> {
    const { data, error } = await this.supabase
      .from('project_files')
      .select('*')
      .eq('project_id', this.projectId)
      .eq('path', path)
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    if (!data) return null

    const mapped = mapRow(data as Record<string, unknown>)
    // Always try to fetch from Blob if storageKey exists (URLs are public)
    if (mapped.storageKey) {
      try {
        mapped.content = await this.fetchBlobContent(mapped.storageKey)
      } catch (e) {
        // If Blob storage is disabled or URL invalid, keep empty content
        console.warn(`[Blob fetch skipped] ${path}:`, e instanceof Error ? e.message : String(e))
      }
    }
    return mapped
  }

  async put(path: string, content: string, language?: string | null): Promise<ProjectFileRecord> {
    const lang = language ?? inferLanguage(path)
    const contentBytes = Buffer.byteLength(content, 'utf8')

    const { data: existing } = await this.supabase
      .from('project_files')
      .select('storage_key, size_bytes')
      .eq('project_id', this.projectId)
      .eq('path', path)
      .maybeSingle()

    const prevBytes = Number(existing?.size_bytes ?? 0)
    await checkQuotaForUpload(this.supabase, this.userId, contentBytes, prevBytes)

    let storageKey: string | null = existing?.storage_key ?? null
    let inlineContent = content
    const sizeBytes = contentBytes

    const useBlob =
      isBlobStorageEnabled() && contentBytes >= INLINE_CONTENT_MAX_BYTES

    if (useBlob) {
      const pathname = projectFileBlobPath(this.userId, this.projectId, path)
      try {
        const blob = await put(pathname, content, {
          access: 'public',
          token: blobToken(),
          contentType: 'text/plain; charset=utf-8',
          addRandomSuffix: false,
          allowOverwrite: true,
        })
        if (!blob.url) {
          throw new Error('Blob put() returned empty URL')
        }
        storageKey = blob.url
        console.log(`[Blob PUT] ${pathname} → ${blob.url}`)
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        console.error(`[Blob PUT error] ${pathname}:`, detail)
        throw new ApiError(503, `No se pudo guardar en almacenamiento: ${detail}`)
      }
      inlineContent = ''
    } else if (isBlobStorageEnabled() && storageKey) {
      await del(storageKey, { token: blobToken() }).catch(() => undefined)
      storageKey = null
    }

    const { data, error } = await this.supabase
      .from('project_files')
      .upsert(
        {
          project_id: this.projectId,
          path,
          content: inlineContent,
          language: lang,
          storage_key: storageKey,
          size_bytes: sizeBytes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,path' },
      )
      .select()
      .single()

    if (error) throw new ApiError(500, error.message)

    await adjustQuota(this.supabase, this.userId, sizeBytes - prevBytes)

    const mapped = mapRow(data as Record<string, unknown>)
    mapped.content = content
    return mapped
  }

  async putMany(
    files: { path: string; content: string; language?: string | null }[],
  ): Promise<ProjectFileRecord[]> {
    const out: ProjectFileRecord[] = []
    for (const f of files) {
      if (!f.path.trim()) continue
      out.push(await this.put(f.path, f.content, f.language))
    }
    return out
  }

  async delete(path: string): Promise<void> {
    const { data: existing } = await this.supabase
      .from('project_files')
      .select('storage_key, size_bytes')
      .eq('project_id', this.projectId)
      .eq('path', path)
      .maybeSingle()

    if (existing?.storage_key && isBlobStorageEnabled()) {
      await del(String(existing.storage_key), { token: blobToken() }).catch(() => undefined)
    }

    const { error } = await this.supabase
      .from('project_files')
      .delete()
      .eq('project_id', this.projectId)
      .eq('path', path)

    if (error) throw new ApiError(500, error.message)

    const prevBytes = Number(existing?.size_bytes ?? 0)
    if (prevBytes > 0) {
      await adjustQuota(this.supabase, this.userId, -prevBytes)
    }
  }

  private async fetchBlobContent(url: string): Promise<string> {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error(`[Blob fetch error] ${url}: ${res.status} ${res.statusText}`, text.slice(0, 200))
        throw new ApiError(500, `No se pudo leer el archivo (${res.status})`)
      }
      return res.text()
    } catch (e) {
      if (e instanceof ApiError) throw e
      console.error(`[Blob fetch exception] ${url}:`, e instanceof Error ? e.message : String(e))
      throw new ApiError(500, 'Error al leer archivo del almacenamiento')
    }
  }
}

export function getProjectFilesStore(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): ProjectFilesStore {
  return new ProjectFilesStore(supabase, userId, projectId)
}

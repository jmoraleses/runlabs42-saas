import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { put } from '@vercel/blob'
import { ApiError } from '@/lib/api/errors'
import type { ChatMessage, ProjectChatSession } from '@/lib/chat/types'
import { blobToken, INLINE_CONTENT_MAX_BYTES, isBlobStorageEnabled } from '@/lib/storage/config'
import { adjustQuota } from '@/lib/storage/quota'

const MESSAGE_BLOB_PREFIX = 'chat-messages'

function messageBlobPath(userId: string, projectId: string, sessionId: string, messageId: string) {
  return `${MESSAGE_BLOB_PREFIX}/${userId}/${projectId}/${sessionId}/${messageId}.txt`
}

function mapSession(row: Record<string, unknown>, messages: ChatMessage[]): ProjectChatSession {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title ?? ''),
    messages,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export class ChatMessageStore {
  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    private projectId: string,
  ) {}

  async listSessions(): Promise<ProjectChatSession[]> {
    const { data: sessions, error } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('project_id', this.projectId)
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false })

    if (error) throw new ApiError(500, error.message)
    const out: ProjectChatSession[] = []
    for (const row of sessions ?? []) {
      const messages = await this.loadMessages(String(row.id))
      out.push(mapSession(row as Record<string, unknown>, messages))
    }
    return out
  }

  async createSession(title = ''): Promise<ProjectChatSession> {
    const { data, error } = await this.supabase
      .from('chat_sessions')
      .insert({
        project_id: this.projectId,
        user_id: this.userId,
        title,
      })
      .select()
      .single()

    if (error || !data) throw new ApiError(500, error?.message ?? 'No se pudo crear la sesión')
    return mapSession(data as Record<string, unknown>, [])
  }

  async saveSession(session: ProjectChatSession): Promise<void> {
    const { error: sessionErr } = await this.supabase
      .from('chat_sessions')
      .update({
        title: session.title,
        updated_at: session.updatedAt || new Date().toISOString(),
      })
      .eq('id', session.id)
      .eq('user_id', this.userId)

    if (sessionErr) throw new ApiError(500, sessionErr.message)

    await this.supabase.from('chat_messages').delete().eq('session_id', session.id)

    let order = 0
    for (const m of session.messages) {
      await this.insertMessage(session.id, m, order++)
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', this.userId)

    if (error) throw new ApiError(500, error.message)
  }

  private async loadMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('sort_order', { ascending: true })

    if (error) throw new ApiError(500, error.message)

    const out: ChatMessage[] = []
    for (const row of data ?? []) {
      let content = String(row.content ?? '')
      const storageKey = row.storage_key ? String(row.storage_key) : null
      // Always try to fetch from Blob if storageKey exists (URLs are public)
      if (storageKey) {
        try {
          content = await this.fetchBlobContent(storageKey)
        } catch (e) {
          // If Blob storage is disabled or URL invalid, keep empty content
          console.warn(`[Blob fetch skipped] message:`, e instanceof Error ? e.message : String(e))
        }
      }
      out.push({
        role: row.role === 'user' ? 'user' : 'assistant',
        content,
        workspaceSnapshotId: row.workspace_snapshot_id
          ? String(row.workspace_snapshot_id)
          : undefined,
      })
    }
    return out
  }

  private async insertMessage(
    sessionId: string,
    message: ChatMessage,
    sortOrder: number,
  ): Promise<void> {
    const content = String(message.content ?? '')
    const sizeBytes = Buffer.byteLength(content, 'utf8')
    let storageKey: string | null = null
    let inline = content

    if (isBlobStorageEnabled() && sizeBytes > INLINE_CONTENT_MAX_BYTES) {
      const id = randomUUID()
      const pathname = messageBlobPath(this.userId, this.projectId, sessionId, id)
      try {
        const blob = await put(pathname, content, {
          access: 'public',
          token: blobToken(),
          contentType: 'text/plain; charset=utf-8',
          addRandomSuffix: false,
        })
        if (!blob.url) {
          throw new Error('Blob put() returned empty URL')
        }
        storageKey = blob.url
        console.log(`[Blob PUT] ${pathname} → ${blob.url}`)
        inline = ''
        await adjustQuota(this.supabase, this.userId, sizeBytes)
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        console.error(`[Blob PUT error] ${pathname}:`, detail)
        throw new ApiError(500, `No se pudo guardar mensaje: ${detail}`)
      }
    }

    const { error } = await this.supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: message.role,
      content: inline,
      storage_key: storageKey,
      size_bytes: sizeBytes,
      workspace_snapshot_id: message.workspaceSnapshotId ?? null,
      sort_order: sortOrder,
    })

    if (error) throw new ApiError(500, error.message)
  }

  private async fetchBlobContent(url: string): Promise<string> {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error(`[Blob fetch error] ${url}: ${res.status} ${res.statusText}`, text.slice(0, 200))
        throw new ApiError(500, `No se pudo leer el mensaje (${res.status})`)
      }
      return res.text()
    } catch (e) {
      if (e instanceof ApiError) throw e
      console.error(`[Blob fetch exception] ${url}:`, e instanceof Error ? e.message : String(e))
      throw new ApiError(500, 'Error al leer mensaje del almacenamiento')
    }
  }
}

/** Historial para el prompt del modelo (servidor). */
export async function loadChatHistoryForPrompt(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  sessionId?: string,
): Promise<ChatMessage[]> {
  if (!sessionId) return []
  const store = new ChatMessageStore(supabase, userId, projectId)
  const sessions = await store.listSessions()
  const session = sessions.find((s) => s.id === sessionId)
  return session?.messages ?? []
}

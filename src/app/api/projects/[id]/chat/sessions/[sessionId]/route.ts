import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { ChatMessageStore } from '@/lib/chat/chatMessageStore'
import { deleteChatSession } from '@/lib/storage/chatImages'
import type { ProjectChatSession } from '@/lib/chat/types'

type Params = { params: Promise<{ id: string; sessionId: string }> }

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id: projectId, sessionId } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, projectId, user.id)
    const body = (await request.json()) as { session?: ProjectChatSession }
    if (!body.session?.id || body.session.id !== sessionId) {
      throw new ApiError(400, 'Sesión inválida')
    }
    const store = new ChatMessageStore(supabase, user.id, projectId)
    await store.saveSession(body.session)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id: projectId, sessionId } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, projectId, user.id)
    const store = new ChatMessageStore(supabase, user.id, projectId)
    await store.deleteSession(sessionId)
    const deleted = await deleteChatSession(user.id, sessionId, projectId)
    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    return jsonError(e)
  }
}

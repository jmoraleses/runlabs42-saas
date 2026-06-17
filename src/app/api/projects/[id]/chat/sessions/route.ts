import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { ChatMessageStore } from '@/lib/chat/chatMessageStore'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, projectId, user.id)
    const store = new ChatMessageStore(supabase, user.id, projectId)
    const sessions = await store.listSessions()
    return NextResponse.json({ sessions })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, projectId, user.id)
    const body = await request.json().catch(() => ({}))
    const title = String((body as { title?: string }).title ?? '')
    const store = new ChatMessageStore(supabase, user.id, projectId)
    const session = await store.createSession(title)
    return NextResponse.json({ session })
  } catch (e) {
    return jsonError(e)
  }
}

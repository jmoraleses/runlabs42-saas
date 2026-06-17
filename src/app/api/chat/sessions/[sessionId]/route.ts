import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { deleteChatSession } from '@/lib/storage/chatImages'

type Params = { params: Promise<{ sessionId: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { sessionId } = await params
    if (!sessionId) throw new ApiError(400, 'sessionId requerido')

    const { user } = await requireUser()
    const projectId = new URL(_request.url).searchParams.get('projectId') ?? undefined
    const deleted = await deleteChatSession(user.id, sessionId, projectId ?? undefined)
    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    return jsonError(e)
  }
}

import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { isDemoProjectId } from '@/lib/auth/demo-server'
import { requireProjectAccess } from '@/lib/projects/access'
import { uploadChatImage } from '@/lib/storage/chatImages'

type Params = { params: Promise<{ sessionId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { sessionId } = await params
    if (!sessionId || sessionId.length > 64) throw new ApiError(400, 'sessionId inválido')

    const { user } = await requireStreamUser()
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new ApiError(400, 'Archivo requerido')

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const projectId = String(form.get('projectId') ?? '').trim()
    if (!projectId) throw new ApiError(400, 'projectId requerido')
    if (!isDemoProjectId(projectId)) {
      const { supabase, user: authUser } = await requireUser()
      await requireProjectAccess(supabase, projectId, authUser.id)
    }

    const ref = await uploadChatImage({
      userId: user.id,
      projectId,
      sessionId,
      fileId,
      buffer,
      name: file.name,
    })

    return NextResponse.json({ image: ref })
  } catch (e) {
    return jsonError(e)
  }
}

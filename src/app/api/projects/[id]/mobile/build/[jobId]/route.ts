import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'

type Params = { params: Promise<{ id: string; jobId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id, jobId } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, id, user.id)

    const { data, error } = await supabase
      .from('mobile_builds')
      .select('id, status, mode, artifact_url, error_message, created_at, completed_at')
      .eq('id', jobId)
      .eq('project_id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) throw new ApiError(404, 'Build no encontrado')

    return NextResponse.json({
      jobId: data.id,
      status: data.status,
      mode: data.mode,
      artifactUrl: data.artifact_url,
      errorMessage: data.error_message,
      createdAt: data.created_at,
      completedAt: data.completed_at,
    })
  } catch (e) {
    return jsonError(e)
  }
}

import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, projectId, user.id)

    const { data, error } = await supabase
      .from('specs')
      .select('id, content, version, created_at')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new ApiError(500, error.message)
    return NextResponse.json({
      spec: data
        ? { id: data.id, content: data.content, version: data.version }
        : { id: null, content: '# Spec\n\n', version: 0 },
    })
  } catch (e) {
    return jsonError(e)
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, projectId, user.id)

    const body = await request.json()
    const content = String(body.content ?? '')

    const { data: latest } = await supabase
      .from('specs')
      .select('id, version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest?.id) {
      const { error } = await supabase.from('specs').update({ content }).eq('id', latest.id)
      if (error) throw new ApiError(500, error.message)
    } else {
      const { error } = await supabase.from('specs').insert({
        project_id: projectId,
        content,
        created_by: user.id,
        version: 1,
      })
      if (error) throw new ApiError(500, error.message)
    }

    await supabase
      .from('projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', projectId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

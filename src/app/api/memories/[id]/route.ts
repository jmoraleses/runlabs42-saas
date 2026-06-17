import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireMemoryUser } from '@/lib/auth/requireMemoryUser'
import { requireProjectAccess } from '@/lib/projects/access'
import { updateLocalMemory, deleteLocalMemory } from '@/lib/studio/localMemoryStore'
import { jsonError, ApiError } from '@/lib/api/errors'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      scope?: 'user' | 'project'
      projectId?: string
      content?: string
      category?: string
    }
    const auth = await requireMemoryUser(body.projectId ?? null)
    if (auth.kind === 'demo') throw new ApiError(403, 'Memoria no disponible en modo demo')
    if (auth.kind === 'local') {
      if (!Object.keys(body).filter((k) => k === 'content' || k === 'category').length) {
        return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })
      }
      const scope = body.scope === 'project' ? 'project' : 'user'
      const ok = await updateLocalMemory(id, scope, body.projectId ?? null, {
        content: body.content,
        category: body.category,
      })
      if (!ok) throw new ApiError(404, 'Memoria no encontrada')
      return NextResponse.json({ ok: true })
    }
    const { supabase, user } = auth

    if (body.scope === 'project' && body.projectId) {
      await requireProjectAccess(supabase, body.projectId, user.id)
    }

    const table = body.scope === 'project' ? 'project_memories' : 'user_memories'
    const updates: Record<string, string> = {}
    if (body.content !== undefined) updates.content = body.content
    if (body.category !== undefined) updates.category = body.category
    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })
    }

    const { error } = await supabase
      .from(table)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') === 'project' ? 'project' : 'user'
    const projectId = url.searchParams.get('projectId')
    const auth = await requireMemoryUser(projectId)
    if (auth.kind === 'demo') throw new ApiError(403, 'Memoria no disponible en modo demo')
    if (auth.kind === 'local') {
      const ok = await deleteLocalMemory(id, scope, projectId)
      if (!ok) throw new ApiError(404, 'Memoria no encontrada')
      return NextResponse.json({ ok: true })
    }
    const { supabase, user } = auth

    if (scope === 'project' && projectId) {
      await requireProjectAccess(supabase, projectId, user.id)
    }

    const table = scope === 'project' ? 'project_memories' : 'user_memories'

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

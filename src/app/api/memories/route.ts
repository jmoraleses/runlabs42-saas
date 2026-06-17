import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireMemoryUser } from '@/lib/auth/requireMemoryUser'
import { requireProjectAccess } from '@/lib/projects/access'
import {
  listLocalProjectMemories,
  listLocalUserMemories,
} from '@/lib/studio/localMemoryStore'
import { jsonError } from '@/lib/api/errors'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId')
    const auth = await requireMemoryUser(projectId)
    if (auth.kind === 'demo') {
      return NextResponse.json({ userMemories: [], projectMemories: [] })
    }
    if (auth.kind === 'local') {
      const userMemories = await listLocalUserMemories()
      const projectMemories = projectId
        ? await listLocalProjectMemories(projectId)
        : []
      return NextResponse.json({ userMemories, projectMemories })
    }
    const { supabase, user } = auth

    if (projectId) {
      await requireProjectAccess(supabase, projectId, user.id)
    }

    const { data: userRows, error: userErr } = await supabase
      .from('user_memories')
      .select('id, category, content, source_project_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (userErr) throw userErr

    let projectRows: {
      id: string
      category: string
      content: string
      project_id: string
      created_at: string
      updated_at: string
    }[] = []
    if (projectId) {
      const { data, error: projErr } = await supabase
        .from('project_memories')
        .select('id, category, content, project_id, created_at, updated_at')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (projErr) throw projErr
      projectRows = data ?? []
    }

    return NextResponse.json({
      userMemories: userRows ?? [],
      projectMemories: projectRows ?? [],
    })
  } catch (e) {
    return jsonError(e)
  }
}

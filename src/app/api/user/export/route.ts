import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'

export async function GET() {
  try {
    const { supabase, user } = await requireUser()

    const [profileRes, projectsRes, txRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('projects').select('*').eq('user_id', user.id).neq('status', 'deleted'),
      supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    ])

    if (profileRes.error) throw new ApiError(500, profileRes.error.message)

    const projectIds = (projectsRes.data ?? []).map((p) => p.id)
    let specs: unknown[] = []
    let files: unknown[] = []

    if (projectIds.length > 0) {
      const [specRes, fileRes] = await Promise.all([
        supabase.from('specs').select('*').in('project_id', projectIds),
        supabase.from('project_files').select('path, language, updated_at, project_id').in('project_id', projectIds),
      ])
      specs = specRes.data ?? []
      files = fileRes.data ?? []
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      profile: profileRes.data,
      projects: projectsRes.data ?? [],
      specs,
      files,
      transactions: txRes.data ?? [],
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="runlabs42-export-${user.id.slice(0, 8)}.json"`,
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}

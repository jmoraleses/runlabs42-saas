import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { requireProjectFilesStore } from '@/lib/storage/requireProjectFilesStore'
import { publishToGithub } from '@/lib/integrations/githubPublish'
import { getGithubAccessToken } from '@/lib/integrations/githubToken'
import { isGithubOAuthConfigured } from '@/lib/integrations/githubOAuth'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, id, user.id)

    const auth = await getGithubAccessToken(supabase, user.id)
    if (!auth?.token) {
      throw new ApiError(403, 'github_auth_required', {
        needsGithubConnect: true,
        oauthConfigured: isGithubOAuthConfigured(),
      })
    }

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, name, github_repo')
      .eq('id', id)
      .single()
    if (projErr || !project) throw new ApiError(404, 'Proyecto no encontrado')

    const store = requireProjectFilesStore(supabase, user.id, id)
    const rows = await store.list()
    if (!rows.length) throw new ApiError(400, 'El proyecto no tiene archivos para publicar')

    const result = await publishToGithub({
      token: auth.token,
      projectName: String(project.name),
      files: rows.map((r) => ({ path: r.path, content: r.content })),
      existingRepo: project.github_repo ? String(project.github_repo) : null,
    })

    await supabase
      .from('projects')
      .update({
        github_repo: result.repoFullName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      ok: true,
      repo: result.repoFullName,
      url: result.htmlUrl,
    })
  } catch (e) {
    return jsonError(e)
  }
}

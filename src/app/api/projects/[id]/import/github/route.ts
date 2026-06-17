import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { requireProjectFilesStore } from '@/lib/storage/requireProjectFilesStore'
import { fetchRepoFiles } from '@/lib/integrations/githubApi'
import { getGithubAccessToken } from '@/lib/integrations/githubToken'
import { isGithubOAuthConfigured } from '@/lib/integrations/githubOAuth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
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

    const body = await request.json()
    const repo = String(body.repo ?? '').trim()
    if (!repo.includes('/')) throw new ApiError(400, 'repo debe ser owner/nombre')
    const branch = body.branch ? String(body.branch) : undefined

    const files = await fetchRepoFiles({ token: auth.token, repo, branch })
    if (!files.length) throw new ApiError(400, 'El repositorio no tiene archivos importables')

    const store = requireProjectFilesStore(supabase, user.id, id)
    await store.putMany(files)

    await supabase
      .from('projects')
      .update({
        github_repo: repo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ ok: true, imported: files.length, repo })
  } catch (e) {
    return jsonError(e)
  }
}

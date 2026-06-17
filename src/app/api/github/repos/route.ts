import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { listUserRepos } from '@/lib/integrations/githubApi'
import { getGithubAccessToken } from '@/lib/integrations/githubToken'
import { isGithubOAuthConfigured } from '@/lib/integrations/githubOAuth'

export async function GET() {
  try {
    const { supabase, user } = await requireUser()
    const auth = await getGithubAccessToken(supabase, user.id)

    if (!auth?.token) {
      throw new ApiError(403, 'github_auth_required', {
        needsGithubConnect: true,
        oauthConfigured: isGithubOAuthConfigured(),
      })
    }

    const repos = await listUserRepos(auth.token)
    return NextResponse.json({
      connected: true,
      login: auth.login,
      repos: repos.map((r) => ({
        fullName: r.full_name,
        name: r.name,
        private: r.private,
        defaultBranch: r.default_branch ?? 'main',
      })),
    })
  } catch (e) {
    return jsonError(e)
  }
}

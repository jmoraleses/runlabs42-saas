import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { getRequestOrigin } from '@/lib/env'
import {
  STATE_COOKIE,
  buildGithubAuthorizationUrl,
  createGithubOAuthState,
  isGithubOAuthConfigured,
} from '@/lib/integrations/githubOAuth'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser()
    const popup = request.nextUrl.searchParams.get('popup') === '1'

    if (!isGithubOAuthConfigured()) {
      throw new ApiError(
        503,
        'GitHub OAuth no está configurado. Añade GITHUB_OAUTH_CLIENT_ID y GITHUB_OAUTH_CLIENT_SECRET.',
      )
    }

    const origin = getRequestOrigin(request)
    const { state, cookieValue } = createGithubOAuthState(user.id, popup)
    const url = await buildGithubAuthorizationUrl({ state, origin })

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 600,
    }

    if (popup) {
      const response = NextResponse.json({ url })
      response.cookies.set(STATE_COOKIE, cookieValue, cookieOpts)
      return response
    }

    const response = NextResponse.redirect(url)
    response.cookies.set(STATE_COOKIE, cookieValue, cookieOpts)
    return response
  } catch (e) {
    return jsonError(e)
  }
}

import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import {
  STATE_COOKIE,
  buildVercelInstallUrl,
  createOAuthState,
  isVercelOAuthConfigured,
} from '@/lib/integrations/vercelOAuth'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser()

    if (!isVercelOAuthConfigured()) {
      throw new ApiError(
        503,
        'Vercel OAuth no está configurado. Añade VERCEL_INTEGRATION_CLIENT_ID, VERCEL_INTEGRATION_CLIENT_SECRET y VERCEL_INTEGRATION_SLUG.',
      )
    }

    const returnTo = request.nextUrl.searchParams.get('returnTo') ?? undefined
    const { state, cookieValue } = createOAuthState(user.id, returnTo)
    const installUrl = buildVercelInstallUrl(state)

    const response = NextResponse.redirect(installUrl)
    response.cookies.set(STATE_COOKIE, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })
    return response
  } catch (e) {
    return jsonError(e)
  }
}

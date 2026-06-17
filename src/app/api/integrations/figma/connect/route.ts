import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { getRequestOrigin } from '@/lib/env'
import {
  STATE_COOKIE,
  buildFigmaAuthorizationUrl,
  createFigmaOAuthState,
  isFigmaOAuthConfigured,
} from '@/lib/integrations/figmaOAuth'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser()
    const popup = request.nextUrl.searchParams.get('popup') === '1'
    const returnTo = request.nextUrl.searchParams.get('returnTo') ?? undefined

    if (!isFigmaOAuthConfigured()) {
      throw new ApiError(
        503,
        'Figma OAuth no está configurado. Añade FIGMA_OAUTH_CLIENT_ID y FIGMA_OAUTH_CLIENT_SECRET.',
      )
    }

    const origin = getRequestOrigin(request)
    const { state, cookieValue } = createFigmaOAuthState(user.id, popup, returnTo)
    const url = buildFigmaAuthorizationUrl({ state, origin })

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

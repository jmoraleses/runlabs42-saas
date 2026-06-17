import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRequestOrigin } from '@/lib/env'
import {
  STATE_COOKIE,
  decodeOAuthState,
  exchangeVercelCode,
  getVercelRedirectUri,
  saveVercelIntegration,
} from '@/lib/integrations/vercelOAuth'

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request)
  const defaultReturnUrl = `${origin}/settings?tab=connect`

  const errorParam = request.nextUrl.searchParams.get('error')
  if (errorParam) {
    return NextResponse.redirect(`${defaultReturnUrl}&vercel=error&message=${encodeURIComponent(errorParam)}`)
  }

  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')
  const cookieState = request.cookies.get(STATE_COOKIE)?.value

  if (!code || !stateParam || !cookieState || stateParam !== cookieState) {
    return NextResponse.redirect(`${defaultReturnUrl}&vercel=error&message=${encodeURIComponent('invalid_state')}`)
  }

  const oauthState = decodeOAuthState(cookieState)
  if (!oauthState) {
    return NextResponse.redirect(`${defaultReturnUrl}&vercel=error&message=${encodeURIComponent('invalid_state')}`)
  }

  // Use returnTo from state if present, otherwise fall back to settings
  const returnBase = oauthState.returnTo
    ? `${origin}${oauthState.returnTo}`
    : defaultReturnUrl

  try {
    const redirectUri = getVercelRedirectUri(origin)
    const tokens = await exchangeVercelCode(code, redirectUri)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== oauthState.userId) {
      return NextResponse.redirect(`${defaultReturnUrl}&vercel=error&message=${encodeURIComponent('unauthorized')}`)
    }

    const username = await saveVercelIntegration(supabase, user.id, tokens.accessToken, tokens.teamId)

    const separator = returnBase.includes('?') ? '&' : '?'
    const response = NextResponse.redirect(
      `${returnBase}${separator}vercel=connected${username ? `&vercelUser=${encodeURIComponent(username)}` : ''}`,
    )
    response.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  } catch (e) {
    const message = e instanceof Error ? e.message : 'connect_failed'
    return NextResponse.redirect(`${defaultReturnUrl}&vercel=error&message=${encodeURIComponent(message)}`)
  }
}

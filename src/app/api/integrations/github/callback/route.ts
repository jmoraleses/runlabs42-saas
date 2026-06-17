import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRequestOrigin } from '@/lib/env'
import {
  STATE_COOKIE,
  decodeGithubOAuthState,
  exchangeGithubCode,
  fetchGithubLogin,
  saveGithubIntegration,
} from '@/lib/integrations/githubOAuth'

const CHANNEL = 'runlabs42-github-oauth'

function popupHtml(origin: string, ok: boolean, message?: string) {
  const payload = JSON.stringify({
    channel: CHANNEL,
    ok,
    message: message ?? null,
  })
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>GitHub</title></head><body>
<script>
  (function () {
    var payload = ${payload};
    if (window.opener) {
      window.opener.postMessage(payload, ${JSON.stringify(origin)});
      window.close();
    } else {
      window.location.href = ${JSON.stringify(origin)} + '/settings?tab=connect&github=' + (payload.ok ? 'connected' : 'error');
    }
  })();
</script>
<p>${ok ? 'GitHub conectado. Puedes cerrar esta ventana.' : 'Error al conectar GitHub.'}</p>
</body></html>`
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request)
  const settingsUrl = `${origin}/settings?tab=connect`

  const errorParam = request.nextUrl.searchParams.get('error')
  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')
  const cookieState = request.cookies.get(STATE_COOKIE)?.value

  if (errorParam) {
    const msg = encodeURIComponent(errorParam)
    if (request.nextUrl.searchParams.get('state')) {
      return new NextResponse(popupHtml(origin, false, errorParam), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }
    return NextResponse.redirect(`${settingsUrl}&github=error&message=${msg}`)
  }

  if (!code || !stateParam || !cookieState || stateParam !== cookieState) {
    const html = popupHtml(origin, false, 'invalid_state')
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const oauthState = decodeGithubOAuthState(cookieState)
  if (!oauthState) {
    return new NextResponse(popupHtml(origin, false, 'invalid_state'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  try {
    const tokens = await exchangeGithubCode(code, origin)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== oauthState.userId) {
      throw new Error('No autorizado')
    }

    const login = await fetchGithubLogin(tokens.accessToken)
    await saveGithubIntegration(supabase, user.id, tokens.accessToken, login)

    const clearCookie = { path: '/', maxAge: 0 }

    if (oauthState.popup) {
      const response = new NextResponse(popupHtml(origin, true), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
      response.cookies.set(STATE_COOKIE, '', clearCookie)
      return response
    }

    const response = NextResponse.redirect(
      `${settingsUrl}&github=connected&githubUser=${encodeURIComponent(login)}`,
    )
    response.cookies.set(STATE_COOKIE, '', clearCookie)
    return response
  } catch (e) {
    const message = e instanceof Error ? e.message : 'connect_failed'
    if (oauthState.popup) {
      return new NextResponse(popupHtml(origin, false, message), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }
    return NextResponse.redirect(`${settingsUrl}&github=error&message=${encodeURIComponent(message)}`)
  }
}

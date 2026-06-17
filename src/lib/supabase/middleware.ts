import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { isAuthPath, isProtectedPath } from '@/lib/auth/routes'
import { isDemoCookieValue, isDemoStreamAllowed } from '@/lib/auth/demo-stream'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname } = request.nextUrl

  // No refrescar sesión en el callback OAuth: getUser() puede interferir con la cookie
  // PKCE (code_verifier) que exchangeCodeForSession necesita en la misma petición.
  if (pathname === '/auth/callback') {
    return supabaseResponse
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const demoBypass =
    isDemoCookieValue(request.cookies.get('runlabs_demo')?.value) && isDemoStreamAllowed()
  if (demoBypass) {
    if (isAuthPath(pathname)) {
      return NextResponse.redirect(new URL('/studio', request.url))
    }
    return supabaseResponse
  }

  const localDevDemo =
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_DEMO_DISABLED !== '1' &&
    (request.nextUrl.hostname === 'localhost' || request.nextUrl.hostname === '127.0.0.1')

  if (localDevDemo && isProtectedPath(pathname) && !user) {
    supabaseResponse.cookies.set('runlabs_demo', '1', {
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
    })
    return supabaseResponse
  }

  if (isProtectedPath(pathname) && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/signin'
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (isAuthPath(pathname) && user) {
    const next = request.nextUrl.searchParams.get('next')
    const dest =
      next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return supabaseResponse
}

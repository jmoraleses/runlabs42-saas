import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { getRequestOrigin } from '@/lib/env'

/**
 * OAuth callback — must set session cookies on the redirect response (Supabase SSR).
 * Lee cookies con next/headers y las escribe en la respuesta de redirección.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = getRequestOrigin(request)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const redirectPath = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  const oauthError =
    searchParams.get('error_description') ||
    searchParams.get('error')
  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/auth/signin?error=${encodeURIComponent(oauthError)}`,
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/signin?error=missing_code`)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.redirect(`${origin}/auth/signin?error=supabase_not_configured`)
  }

  const redirectUrl = `${origin}${redirectPath}`
  const response = NextResponse.redirect(redirectUrl)
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const hint =
      error.message.includes('code verifier') ||
      error.message.includes('both auth code and code verifier')
        ? 'pkce_missing'
        : error.message.includes('Unable to exchange external code')
          ? 'google_exchange_failed'
          : 'auth_callback'
    return NextResponse.redirect(
      `${origin}/auth/signin?error=${encodeURIComponent(error.message)}&hint=${hint}`,
    )
  }

  // Check if user has completed onboarding; redirect new users to the wizard
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (authUser) {
      const { data: userRow } = await supabase
        .from('users')
        .select('settings')
        .eq('id', authUser.id)
        .maybeSingle()
      const settings = (userRow?.settings as Record<string, unknown>) ?? {}
      if (!settings.onboardingCompleted) {
        const onboardingResponse = NextResponse.redirect(`${origin}/onboarding`)
        response.cookies.getAll().forEach(({ name, value }) => {
          onboardingResponse.cookies.set(name, value)
        })
        return onboardingResponse
      }
    }
  } catch {
    // If check fails, proceed to original destination
  }

  return response
}

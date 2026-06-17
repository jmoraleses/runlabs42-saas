import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/env'

const AUTH_UNAVAILABLE = {
  data: { user: null, session: null },
  error: { message: 'Autenticación no disponible: configura Supabase en .env.local', name: 'AuthError' },
} as const

function requireAuthClient() {
  const supabase = createClient()
  if (!supabase) return null
  return supabase
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = requireAuthClient()
  if (!supabase) return AUTH_UNAVAILABLE
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = requireAuthClient()
  if (!supabase) return AUTH_UNAVAILABLE
  const appUrl = typeof window !== 'undefined' ? window.location.origin : getAppUrl()
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  })
}

export async function signInWithOAuth(
  provider: 'github' | 'google',
  nextPath = '/',
) {
  const supabase = requireAuthClient()
  if (!supabase) return AUTH_UNAVAILABLE
  const appUrl = typeof window !== 'undefined' ? window.location.origin : getAppUrl()
  const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/'
  const options: {
    redirectTo: string
    queryParams?: Record<string, string>
  } = {
    redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`,
  }
  // No añadir access_type=offline ni prompt=consent: pueden provocar "Unable to exchange external code" en Supabase.
  return supabase.auth.signInWithOAuth({ provider, options })
}

export async function signOut() {
  const supabase = requireAuthClient()
  if (!supabase) return AUTH_UNAVAILABLE
  return supabase.auth.signOut()
}

export async function resetPasswordForEmail(email: string) {
  const supabase = requireAuthClient()
  if (!supabase) return AUTH_UNAVAILABLE
  const appUrl = typeof window !== 'undefined' ? window.location.origin : getAppUrl()
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/reset/confirm`,
  })
}

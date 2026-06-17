function normalizeSupabaseUrl(raw?: string | null): string {
  return (raw ?? '').trim().replace(/\/$/, '')
}

/** URL de Supabase desde variables de entorno (nunca hardcodeada en el repo). */
export function getSupabaseUrl(): string {
  return normalizeSupabaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  )
}

/** Ref del proyecto (subdominio) si la URL es *.supabase.co. */
export function getSupabaseProjectRef(): string | null {
  const url = getSupabaseUrl()
  if (!url || url.includes('127.0.0.1') || url.includes('localhost')) return null
  const match = url.match(/^https?:\/\/([^.]+)\.supabase\.co/i)
  return match?.[1] ?? null
}

/** OAuth apps (GitHub/Google) deben registrar este callback — no la URL de la app. */
export function getSupabaseOAuthCallback(): string {
  const url = getSupabaseUrl()
  return url ? `${url}/auth/v1/callback` : ''
}

export const SUPABASE_OAUTH_CALLBACK = getSupabaseOAuthCallback()

export const APP_AUTH_CALLBACKS = [
  'http://localhost:3000/auth/callback',
  'http://localhost:3010/auth/callback',
] as const

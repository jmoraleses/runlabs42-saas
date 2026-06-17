type AuthErrorLike =
  | string
  | null
  | undefined
  | {
      message?: string
      msg?: string
      code?: string
      error_code?: string
    }

const PROVIDER_LABELS: Record<string, string> = {
  github: 'GitHub',
  google: 'Google',
}

export function formatAuthError(
  error: AuthErrorLike,
  provider?: 'github' | 'google',
): string {
  if (!error) return 'Error de autenticación'

  let text =
    typeof error === 'string'
      ? error
      : error.msg || error.message || error.error_code || 'Error de autenticación'

  if (typeof error === 'string' && error.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(error) as { msg?: string; message?: string }
      text = parsed.msg || parsed.message || text
    } catch {
      /* keep original */
    }
  }

  const providerLabel = provider ? PROVIDER_LABELS[provider] || provider : 'OAuth'

  if (
    text.includes('provider is not enabled') ||
    text.includes('Unsupported provider')
  ) {
    return `${providerLabel} no está habilitado en tu proyecto Supabase. Ve a Authentication → Providers, actívalo y añade Client ID y Client Secret.`
  }

  if (text === 'missing_code') {
    return 'No se recibió el código de autorización. Intenta iniciar sesión de nuevo.'
  }

  if (text === 'supabase_not_configured') {
    return 'Supabase no está configurado. Revisa las variables de entorno en Vercel.'
  }

  if (text === 'auth_callback') {
    return 'No se pudo completar el inicio de sesión. Revisa las URLs de redirección en Supabase.'
  }

  if (text.includes('Unable to exchange external code')) {
    return (
      'Google no pudo validar el inicio de sesión con Supabase. ' +
      'Revisa en Supabase → Authentication → Providers → Google que el Client ID y Client Secret ' +
      'coincidan con Google Cloud Console (sin espacios al pegar). ' +
      'En Google Cloud, la única URI de redirección autorizada debe ser: ' +
      'https://uqawltpguhjnkioqeqsh.supabase.co/auth/v1/callback'
    )
  }

  if (
    text.includes('code verifier') ||
    text.includes('both auth code and code verifier')
  ) {
    return (
      'La sesión OAuth expiró o las cookies no se guardaron. ' +
      'Usa siempre la misma URL (p. ej. https://www.runlabs42.com, no mezclar con runlabs42.com sin www). ' +
      'Añade esa URL exacta en Supabase → Authentication → URL Configuration → Redirect URLs, ' +
      'intenta en una ventana normal (no incógnito) e inicia sesión de nuevo.'
    )
  }

  return text
}

/** Mensaje ampliado según hint del callback OAuth. */
export function formatAuthErrorHint(hint: string | null): string | null {
  if (hint === 'google_exchange_failed') {
    return (
      'Causa habitual: Client Secret incorrecto en Supabase o redirect URI distinta en Google Cloud. ' +
      'Ver supabase/OAUTH-SETUP.md en el repositorio.'
    )
  }
  if (hint === 'pkce_missing') {
    return (
      'Causa habitual: dominio distinto al registrado (www vs sin www) o falta la URL en Redirect URLs de Supabase.'
    )
  }
  return null
}

/** URL de callback que GitHub/Google deben registrar en su consola de desarrollador */
export function getSupabaseOAuthCallbackUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  return `${url.replace(/\/$/, '')}/auth/v1/callback`
}

export { SUPABASE_OAUTH_CALLBACK } from '@/lib/supabase/project'

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { getAppUrl } from '@/lib/env'
import { validateVercelToken } from './vercelApi'

const STATE_COOKIE = 'vercel_oauth_state'
const STATE_TTL_MS = 10 * 60 * 1000

export type VercelOAuthState = {
  userId: string
  nonce: string
  issuedAt: number
  returnTo?: string
}

export type VercelTokenExchange = {
  accessToken: string
  teamId: string | null
  configurationId: string | null
  userId: string | null
}

import { getOAuthStateSecret } from './oauthStateSecret'

function oauthSecret(): string {
  return getOAuthStateSecret(process.env.VERCEL_INTEGRATION_CLIENT_SECRET)
}

function signPayload(payload: string): string {
  return createHmac('sha256', oauthSecret()).update(payload).digest('base64url')
}

export function encodeOAuthState(state: VercelOAuthState): string {
  const json = JSON.stringify(state)
  const body = Buffer.from(json, 'utf8').toString('base64url')
  return `${body}.${signPayload(body)}`
}

export function decodeOAuthState(value: string): VercelOAuthState | null {
  const [body, sig] = value.split('.')
  if (!body || !sig) return null
  const expected = signPayload(body)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as VercelOAuthState
    if (!parsed.userId || !parsed.nonce || !parsed.issuedAt) return null
    if (Date.now() - parsed.issuedAt > STATE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function getVercelRedirectUri(origin?: string): string {
  const base = (origin ?? getAppUrl()).replace(/\/$/, '')
  return `${base}/api/integrations/vercel/callback`
}

export function isVercelOAuthConfigured(): boolean {
  return !!(
    process.env.VERCEL_INTEGRATION_CLIENT_ID &&
    process.env.VERCEL_INTEGRATION_CLIENT_SECRET &&
    process.env.VERCEL_INTEGRATION_SLUG
  )
}

export function buildVercelInstallUrl(state: string): string {
  const slug = process.env.VERCEL_INTEGRATION_SLUG!
  const params = new URLSearchParams({ state })
  return `https://vercel.com/integrations/${slug}/new?${params.toString()}`
}

export function createOAuthState(userId: string, returnTo?: string): { state: string; cookieValue: string } {
  const payload: VercelOAuthState = {
    userId,
    nonce: randomBytes(16).toString('base64url'),
    issuedAt: Date.now(),
    ...(returnTo ? { returnTo } : {}),
  }
  const cookieValue = encodeOAuthState(payload)
  return { state: cookieValue, cookieValue }
}

export { STATE_COOKIE }

export async function exchangeVercelCode(
  code: string,
  redirectUri: string,
): Promise<VercelTokenExchange> {
  const clientId = process.env.VERCEL_INTEGRATION_CLIENT_ID
  const clientSecret = process.env.VERCEL_INTEGRATION_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Integración de Vercel no configurada en el servidor')
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  })

  const res = await fetch('https://api.vercel.com/v2/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Vercel OAuth ${res.status}`)
  }

  const data = (await res.json()) as {
    access_token?: string
    token_type?: string
    team_id?: string | null
    user_id?: string | null
    installation_id?: string
  }

  if (!data.access_token) {
    throw new Error('Vercel no devolvió un access token')
  }

  return {
    accessToken: data.access_token,
    teamId: data.team_id ?? null,
    configurationId: data.installation_id ?? null,
    userId: data.user_id ?? null,
  }
}

export async function saveVercelIntegration(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  userId: string,
  accessToken: string,
  teamId: string | null,
) {
  const { encryptSecret } = await import('./crypto')
  const check = await validateVercelToken(accessToken)
  if (!check.ok || !check.user) {
    throw new Error(check.message ?? 'Token de Vercel rechazado')
  }

  const patch = {
    vercel_team_id: teamId ?? check.user.defaultTeamId ?? null,
    vercel_access_token_enc: encryptSecret(accessToken),
    vercel_connected_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('user_integrations')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('user_integrations').update(patch).eq('user_id', userId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('user_integrations').insert({ user_id: userId, ...patch })
    if (error) throw new Error(error.message)
  }

  return check.user.username
}

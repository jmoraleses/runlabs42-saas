import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/env'
import { encryptSecret } from './crypto'

const STATE_COOKIE = 'figma_oauth_state'
const STATE_TTL_MS = 10 * 60 * 1000
const FIGMA_AUTH_URL = 'https://www.figma.com/oauth'
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token'

export type FigmaOAuthState = {
  userId: string
  nonce: string
  issuedAt: number
  popup: boolean
  returnTo?: string
}

function oauthSecret(): string {
  return (
    process.env.INTEGRATIONS_ENCRYPTION_KEY ||
    process.env.FIGMA_OAUTH_CLIENT_SECRET ||
    'dev-runlabs42-figma-oauth'
  )
}

function signPayload(payload: string): string {
  return createHmac('sha256', oauthSecret()).update(payload).digest('base64url')
}

export function encodeFigmaOAuthState(state: FigmaOAuthState): string {
  const json = JSON.stringify(state)
  const body = Buffer.from(json, 'utf8').toString('base64url')
  return `${body}.${signPayload(body)}`
}

export function decodeFigmaOAuthState(value: string): FigmaOAuthState | null {
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
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as FigmaOAuthState
    if (!parsed.userId || !parsed.nonce || !parsed.issuedAt) return null
    if (Date.now() - parsed.issuedAt > STATE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function isFigmaOAuthConfigured(): boolean {
  return !!(process.env.FIGMA_OAUTH_CLIENT_ID && process.env.FIGMA_OAUTH_CLIENT_SECRET)
}

export function getFigmaRedirectUri(origin?: string): string {
  const base = (origin ?? getAppUrl()).replace(/\/$/, '')
  return `${base}/api/integrations/figma/callback`
}

export function createFigmaOAuthState(
  userId: string,
  popup: boolean,
  returnTo?: string,
): { state: string; cookieValue: string } {
  const payload: FigmaOAuthState = {
    userId,
    nonce: randomBytes(16).toString('base64url'),
    issuedAt: Date.now(),
    popup,
    returnTo,
  }
  const cookieValue = encodeFigmaOAuthState(payload)
  return { state: cookieValue, cookieValue }
}

export function buildFigmaAuthorizationUrl(params: {
  state: string
  origin?: string
}): string {
  const clientId = process.env.FIGMA_OAUTH_CLIENT_ID
  if (!clientId) throw new Error('FIGMA_OAUTH_CLIENT_ID no configurado')
  const url = new URL(FIGMA_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', getFigmaRedirectUri(params.origin))
  url.searchParams.set('scope', 'file_read')
  url.searchParams.set('state', params.state)
  url.searchParams.set('response_type', 'code')
  return url.toString()
}

export type FigmaTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  user_id_string?: string
}

export async function exchangeFigmaCode(
  code: string,
  origin?: string,
): Promise<FigmaTokenResponse> {
  const clientId = process.env.FIGMA_OAUTH_CLIENT_ID
  const clientSecret = process.env.FIGMA_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Figma OAuth no configurado')

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getFigmaRedirectUri(origin),
    code,
    grant_type: 'authorization_code',
  })

  const res = await fetch(FIGMA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Figma token exchange failed: ${err.slice(0, 200)}`)
  }
  return (await res.json()) as FigmaTokenResponse
}

export async function fetchFigmaUserId(accessToken: string): Promise<string> {
  const res = await fetch('https://api.figma.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('No se pudo obtener el perfil de Figma')
  const data = (await res.json()) as { id?: string; email?: string }
  return data.id ?? data.email ?? 'figma'
}

export async function saveFigmaIntegration(
  supabase: SupabaseClient,
  userId: string,
  tokens: FigmaTokenResponse,
): Promise<void> {
  const figmaUserId = tokens.user_id_string ?? (await fetchFigmaUserId(tokens.access_token))
  const patch = {
    figma_access_token_enc: encryptSecret(tokens.access_token),
    figma_refresh_token_enc: tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : null,
    figma_user_id: figmaUserId,
    figma_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('user_integrations')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('user_integrations').update(patch).eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('user_integrations').insert({ user_id: userId, ...patch })
    if (error) throw error
  }
}

export async function getFigmaAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { decryptSecret } = await import('./crypto')
  const { data } = await supabase
    .from('user_integrations')
    .select('figma_access_token_enc')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data?.figma_access_token_enc) return null
  try {
    return decryptSecret(data.figma_access_token_enc)
  } catch {
    return null
  }
}

export { STATE_COOKIE }

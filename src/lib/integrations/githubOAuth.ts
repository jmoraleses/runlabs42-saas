import { OAuthApp } from '@octokit/oauth-app'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/env'
import { encryptSecret } from './crypto'

const STATE_COOKIE = 'github_oauth_state'
const STATE_TTL_MS = 10 * 60 * 1000

export type GithubOAuthState = {
  userId: string
  nonce: string
  issuedAt: number
  popup: boolean
}

import { getOAuthStateSecret } from './oauthStateSecret'

function oauthSecret(): string {
  return getOAuthStateSecret(process.env.GITHUB_OAUTH_CLIENT_SECRET)
}

function signPayload(payload: string): string {
  return createHmac('sha256', oauthSecret()).update(payload).digest('base64url')
}

export function encodeGithubOAuthState(state: GithubOAuthState): string {
  const json = JSON.stringify(state)
  const body = Buffer.from(json, 'utf8').toString('base64url')
  return `${body}.${signPayload(body)}`
}

export function decodeGithubOAuthState(value: string): GithubOAuthState | null {
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
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as GithubOAuthState
    if (!parsed.userId || !parsed.nonce || !parsed.issuedAt) return null
    if (Date.now() - parsed.issuedAt > STATE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function isGithubOAuthConfigured(): boolean {
  return !!(process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET)
}

function createOAuthApp(): OAuthApp {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth no configurado (GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET)')
  }
  return new OAuthApp({
    clientType: 'oauth-app',
    clientId,
    clientSecret,
  })
}

export function getGithubRedirectUri(origin?: string): string {
  const base = (origin ?? getAppUrl()).replace(/\/$/, '')
  return `${base}/api/integrations/github/callback`
}

export function createGithubOAuthState(
  userId: string,
  popup: boolean,
): { state: string; cookieValue: string } {
  const payload: GithubOAuthState = {
    userId,
    nonce: randomBytes(16).toString('base64url'),
    issuedAt: Date.now(),
    popup,
  }
  const cookieValue = encodeGithubOAuthState(payload)
  return { state: cookieValue, cookieValue }
}

export async function buildGithubAuthorizationUrl(params: {
  state: string
  origin?: string
}): Promise<string> {
  const app = createOAuthApp()
  const { url } = await app.getWebFlowAuthorizationUrl({
    state: params.state,
    redirectUrl: getGithubRedirectUri(params.origin),
    scopes: ['read:user', 'repo'],
  })
  return url
}

export async function exchangeGithubCode(
  code: string,
  origin?: string,
): Promise<{ accessToken: string }> {
  const app = createOAuthApp()
  const { authentication } = await app.createToken({
    code,
    redirectUrl: getGithubRedirectUri(origin),
  })
  return { accessToken: authentication.token }
}

export async function fetchGithubLogin(accessToken: string): Promise<string> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error('No se pudo obtener el perfil de GitHub')
  const data = (await res.json()) as { login?: string }
  return data.login ?? 'github'
}

export async function saveGithubIntegration(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  login: string,
): Promise<void> {
  const patch = {
    github_access_token_enc: encryptSecret(accessToken),
    github_login: login,
    github_connected_at: new Date().toISOString(),
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

export { STATE_COOKIE }

'use client'

import {
  openOAuthTabWindow,
  waitForOAuthPopup,
} from './oauthPopup'

const CHANNEL = 'runlabs42-github-oauth'

export const GITHUB_SIGN_IN_REQUIRED = 'GITHUB_SIGN_IN_REQUIRED'
export const GITHUB_OAUTH_NOT_CONFIGURED = 'GITHUB_OAUTH_NOT_CONFIGURED'

/** Pestaña preparada en el mismo tick del clic (antes de cualquier await). */
let primedTab: Window | null = null

type GithubCheckBody = {
  error?: string
  details?: { needsGithubConnect?: boolean; oauthConfigured?: boolean }
}

export type GithubConnectionCheck = {
  connected: boolean
  needsSignIn: boolean
  oauthConfigured: boolean
}

export async function checkGithubConnection(): Promise<GithubConnectionCheck> {
  const res = await fetch('/api/github/repos', { credentials: 'include' })
  const data = (await res.json().catch(() => ({}))) as GithubCheckBody

  if (res.ok) {
    return { connected: true, needsSignIn: false, oauthConfigured: true }
  }

  if (res.status === 401) {
    return { connected: false, needsSignIn: true, oauthConfigured: true }
  }

  if (
    res.status === 403 ||
    data.details?.needsGithubConnect ||
    data.error === 'github_auth_required'
  ) {
    return {
      connected: false,
      needsSignIn: false,
      oauthConfigured: data.details?.oauthConfigured !== false,
    }
  }

  throw new Error(data.error ?? 'No se pudo comprobar la conexión con GitHub')
}

/** Llamar de forma síncrona en el onClick (gesto del usuario). */
export function primeGithubOAuthTab(): void {
  if (typeof window === 'undefined') return
  discardPrimedGithubTab()
  try {
    primedTab = openOAuthTabWindow(CHANNEL)
  } catch {
    primedTab = null
  }
}

/** @deprecated Usar primeGithubOAuthTab */
export const primeGithubOAuthPopup = primeGithubOAuthTab

export function discardPrimedGithubTab(): void {
  try {
    primedTab?.close()
  } catch {
    /* ignore */
  }
  primedTab = null
}

/** @deprecated Usar discardPrimedGithubTab */
export const discardPrimedGithubPopup = discardPrimedGithubTab

async function fetchGithubAuthorizationUrl(): Promise<string> {
  const res = await fetch('/api/integrations/github/connect?popup=1', {
    credentials: 'include',
  })
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? 'No se pudo iniciar la conexión con GitHub')
  }
  if (!data.url) throw new Error('URL de autorización no disponible')
  return data.url
}

/** Abre pestaña de GitHub OAuth (permisos de lectura de repos) y espera el callback. */
export async function connectGithubPopup(): Promise<void> {
  const tab = primedTab ?? openOAuthTabWindow(CHANNEL)
  primedTab = null
  try {
    tab.location.href = await fetchGithubAuthorizationUrl()
    await waitForOAuthPopup(tab, CHANNEL)
  } catch (e) {
    try {
      tab.close()
    } catch {
      /* ignore */
    }
    throw e
  }
}

/**
 * Comprueba si GitHub está conectado; si no, usa la pestaña preparada o abre una nueva.
 */
export async function ensureGithubConnected(): Promise<void> {
  let check = await checkGithubConnection()
  if (check.connected) {
    discardPrimedGithubTab()
    return
  }

  if (check.needsSignIn) {
    discardPrimedGithubTab()
    throw new Error(GITHUB_SIGN_IN_REQUIRED)
  }

  if (!check.oauthConfigured) {
    discardPrimedGithubTab()
    throw new Error(GITHUB_OAUTH_NOT_CONFIGURED)
  }

  await connectGithubPopup()

  check = await checkGithubConnection()
  if (!check.connected) {
    throw new Error('No se pudo conectar con GitHub tras autorizar')
  }
}

'use client'

import { openOAuthTabWindow, waitForOAuthPopup } from './oauthPopup'

const CHANNEL = 'runlabs42-figma-oauth'

let primedTab: Window | null = null

export function primeFigmaOAuthTab(): void {
  if (typeof window === 'undefined') return
  discardPrimedFigmaTab()
  try {
    primedTab = openOAuthTabWindow(CHANNEL)
  } catch {
    primedTab = null
  }
}

export function discardPrimedFigmaTab(): void {
  try {
    primedTab?.close()
  } catch {
    /* ignore */
  }
  primedTab = null
}

async function fetchFigmaAuthorizationUrl(): Promise<string> {
  const res = await fetch('/api/integrations/figma/connect?popup=1', {
    credentials: 'include',
  })
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? 'No se pudo iniciar OAuth de Figma')
  }
  return data.url
}

export async function connectFigmaPopup(): Promise<void> {
  const url = await fetchFigmaAuthorizationUrl()
  const win = primedTab ?? openOAuthTabWindow(CHANNEL)
  primedTab = null
  win.location.href = url
  await waitForOAuthPopup(win, CHANNEL)
}

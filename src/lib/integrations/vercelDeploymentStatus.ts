import { decryptSecret } from './crypto'
import type { UserIntegrationRow } from './types'

function vercelHeaders(token: string, teamId?: string | null): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }
  if (teamId) h['x-vercel-team-id'] = teamId
  return h
}

export type VercelDeploymentState = {
  id: string
  readyState: string
  url: string | null
  errorMessage: string | null
  buildLog: string
}

export async function fetchVercelDeploymentStatus(
  integration: UserIntegrationRow,
  deploymentId: string,
): Promise<VercelDeploymentState> {
  const token = decryptSecret(integration.vercel_access_token_enc!)
  const teamId = integration.vercel_team_id

  const depRes = await fetch(
    `https://api.vercel.com/v13/deployments/${deploymentId}`,
    { headers: vercelHeaders(token, teamId) },
  )
  const dep = (await depRes.json()) as {
    readyState?: string
    url?: string
    errorMessage?: string
    error?: { message?: string }
  }
  if (!depRes.ok) {
    throw new Error(dep.error?.message ?? `Vercel status ${depRes.status}`)
  }

  let buildLog = ''
  try {
    const eventsRes = await fetch(
      `https://api.vercel.com/v2/deployments/${deploymentId}/events?limit=200&direction=backward`,
      { headers: vercelHeaders(token, teamId) },
    )
    if (eventsRes.ok) {
      const events = (await eventsRes.json()) as Array<{ type?: string; payload?: { text?: string } }>
      buildLog = events
        .filter((e) => e.type === 'stdout' || e.type === 'stderr')
        .map((e) => e.payload?.text ?? '')
        .reverse()
        .join('')
        .trim()
    }
  } catch {
    /* optional log */
  }

  const host = dep.url
  const url = host ? (host.startsWith('http') ? host : `https://${host}`) : null

  return {
    id: deploymentId,
    readyState: dep.readyState ?? 'UNKNOWN',
    url,
    errorMessage: dep.errorMessage ?? dep.error?.message ?? null,
    buildLog,
  }
}

export function mapReadyStateToStatus(
  readyState: string,
): 'building' | 'ready' | 'error' | 'cancelled' {
  const s = readyState.toUpperCase()
  if (s === 'READY') return 'ready'
  if (s === 'ERROR' || s === 'FAILED') return 'error'
  if (s === 'CANCELED' || s === 'CANCELLED') return 'cancelled'
  return 'building'
}

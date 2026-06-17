import { decryptSecret } from './crypto'
import type { UserIntegrationRow } from './types'

function vercelHeaders(token: string, teamId?: string | null): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  if (teamId) h['x-vercel-team-id'] = teamId
  return h
}

export type VercelEnvVar = {
  key: string
  value: string
  target?: Array<'production' | 'preview' | 'development'>
}

/** Crea o actualiza variables de entorno en un proyecto Vercel del usuario. */
export async function upsertVercelProjectEnv(params: {
  integration: UserIntegrationRow
  projectId: string
  variables: VercelEnvVar[]
}): Promise<void> {
  if (!params.variables.length) return
  const token = decryptSecret(params.integration.vercel_access_token_enc!)
  const teamId = params.integration.vercel_team_id

  for (const v of params.variables) {
    if (!v.value?.trim()) continue
    const res = await fetch(
      `https://api.vercel.com/v10/projects/${params.projectId}/env?upsert=true`,
      {
        method: 'POST',
        headers: vercelHeaders(token, teamId),
        body: JSON.stringify({
          key: v.key,
          value: v.value,
          type: 'encrypted',
          target: v.target ?? ['production', 'preview'],
        }),
      },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(body || `Vercel env ${v.key} failed (${res.status})`)
    }
  }
}

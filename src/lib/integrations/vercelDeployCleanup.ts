import { decryptSecret } from './crypto'
import type { UserIntegrationRow } from './types'

function vercelHeaders(token: string, teamId?: string | null): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }
  if (teamId) h['x-vercel-team-id'] = teamId
  return h
}

export async function cancelVercelDeployment(
  integration: UserIntegrationRow,
  deploymentId: string,
): Promise<void> {
  const token = decryptSecret(integration.vercel_access_token_enc!)
  await fetch(`https://api.vercel.com/v12/deployments/${deploymentId}/cancel`, {
    method: 'PATCH',
    headers: vercelHeaders(token, integration.vercel_team_id),
  })
}

export async function deleteVercelDeployment(
  integration: UserIntegrationRow,
  deploymentId: string,
): Promise<void> {
  const token = decryptSecret(integration.vercel_access_token_enc!)
  await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
    method: 'DELETE',
    headers: vercelHeaders(token, integration.vercel_team_id),
  })
}

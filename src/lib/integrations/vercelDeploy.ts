import { decryptSecret } from './crypto'
import type { UserIntegrationRow } from './types'
import { detectDeployFramework } from '@/lib/publish/detectDeployFramework'
import {
  upsertVercelProjectEnv,
  type VercelEnvVar,
} from '@/lib/integrations/vercelProjectEnv'

export type DeployFile = { path: string; content: string }
export type VercelDeployTarget = 'production' | 'preview'

function vercelHeaders(token: string, teamId?: string | null): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  if (teamId) h['x-vercel-team-id'] = teamId
  return h
}

export type VercelDeploymentResult = {
  deploymentUrl: string
  projectId: string
  deploymentId: string
}

export async function deployProjectToVercel(params: {
  integration: UserIntegrationRow
  projectName: string
  files: DeployFile[]
  existingProjectId?: string | null
  target?: VercelDeployTarget
  envVariables?: VercelEnvVar[]
}): Promise<VercelDeploymentResult> {
  const token = decryptSecret(params.integration.vercel_access_token_enc!)
  const teamId = params.integration.vercel_team_id
  const target = params.target ?? 'production'
  const slug = params.projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 48)

  let projectId = params.existingProjectId ?? null
  const framework = detectDeployFramework(params.files) ?? 'vite'

  if (!projectId) {
    const createRes = await fetch('https://api.vercel.com/v9/projects', {
      method: 'POST',
      headers: vercelHeaders(token, teamId),
      body: JSON.stringify({ name: slug || 'runlabs-app', framework }),
    })
    if (!createRes.ok) {
      const body = await createRes.text()
      throw new Error(body || `Vercel create project ${createRes.status}`)
    }
    const created = (await createRes.json()) as { id: string }
    projectId = created.id
  }

  if (params.envVariables?.length) {
    await upsertVercelProjectEnv({
      integration: params.integration,
      projectId: projectId!,
      variables: params.envVariables,
    })
  }

  const filePayload = params.files.map((f) => ({
    file: f.path.replace(/^\/+/, ''),
    data: f.content,
    encoding: 'utf-8' as const,
  }))

  const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: vercelHeaders(token, teamId),
    body: JSON.stringify({
      name: slug || 'runlabs-app',
      project: projectId,
      files: filePayload,
      target,
    }),
  })

  if (!deployRes.ok) {
    const body = await deployRes.text()
    throw new Error(body || `Vercel deploy ${deployRes.status}`)
  }

  const deployment = (await deployRes.json()) as {
    url?: string
    alias?: string[]
    id: string
  }

  const host = deployment.url ?? deployment.alias?.[0]
  const deploymentUrl = host ? (host.startsWith('http') ? host : `https://${host}`) : ''

  return {
    deploymentUrl,
    projectId: projectId!,
    deploymentId: deployment.id,
  }
}

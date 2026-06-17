import 'server-only'

import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import path from 'path'
import { getVertexAICredentials } from '@/lib/ai/config.server'
import { getVertexBearerToken } from '@/lib/ai/vertexAgentPlatform'
import {
  getDesignCloudOrchestratorSetting,
  saveDesignCloudOrchestratorSetting,
} from '@/lib/platform/designCloudOrchestratorSetting.server'

const ORCHESTRATOR_DISPLAY_NAME = 'spec-design-orchestrator'

function projectRoot(): string {
  return process.cwd()
}

function deployLogPath(): string {
  return path.join(projectRoot(), '.deploy-design-agent-last.log')
}

function deployScriptPath(): string {
  return path.join(projectRoot(), 'agents/design-orchestrator/deploy.py')
}

async function vertexFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getVertexBearerToken()
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
}

function parseEngineId(resource: string): string | null {
  const m = resource.match(/reasoningEngines\/(\d+)/)
  return m?.[1] ?? null
}

export type CloudOrchestratorStatus = {
  setting: Awaited<ReturnType<typeof getDesignCloudOrchestratorSetting>>
  engines: Array<{ id: string; resource: string; createTime?: string }>
  stagingBucket: string | null
  gcpConfigured: boolean
}

export async function getCloudOrchestratorStatus(): Promise<CloudOrchestratorStatus> {
  const creds = getVertexAICredentials()
  const setting = await getDesignCloudOrchestratorSetting()
  const engines: CloudOrchestratorStatus['engines'] = []

  if (creds) {
    try {
      const res = await vertexFetch(
        `https://${creds.location}-aiplatform.googleapis.com/v1/projects/${creds.projectId}/locations/${creds.location}/reasoningEngines?pageSize=50`,
      )
      if (res.ok) {
        const body = (await res.json()) as {
          reasoningEngines?: Array<{ name?: string; createTime?: string; displayName?: string }>
        }
        for (const e of body.reasoningEngines ?? []) {
          if (e.displayName !== ORCHESTRATOR_DISPLAY_NAME || !e.name) continue
          const id = parseEngineId(e.name)
          if (id) engines.push({ id, resource: e.name, createTime: e.createTime })
        }
      }
    } catch {
      /* credenciales o red */
    }
  }

  let resolvedSetting = setting
  if (engines.length > 0 && !setting.engineResource) {
    resolvedSetting = await saveDesignCloudOrchestratorSetting({
      engineResource: engines[0]!.resource,
      deployStatus: setting.deployStatus === 'idle' ? 'ready' : setting.deployStatus,
    })
  } else if (setting.engineResource) {
    const liveResources = new Set(engines.map((e) => e.resource))
    if (!liveResources.has(setting.engineResource)) {
      resolvedSetting = await saveDesignCloudOrchestratorSetting({
        enabled: false,
        engineResource: null,
        deployStatus: 'idle',
        deployMessage: 'Engine no desplegado en GCP',
      })
    }
  }

  return {
    setting: resolvedSetting,
    engines,
    stagingBucket: creds ? `${creds.projectId}-agent-engine-staging` : null,
    gcpConfigured: Boolean(creds?.projectId),
  }
}

export async function deployCloudOrchestrator(): Promise<{
  engineResource: string
  setting: Awaited<ReturnType<typeof saveDesignCloudOrchestratorSetting>>
}> {
  const creds = getVertexAICredentials()
  if (!creds?.projectId) {
    throw new Error('Vertex AI no configurado (GOOGLE_CLOUD_PROJECT_ID / credenciales).')
  }

  const current = await getDesignCloudOrchestratorSetting()
  await saveDesignCloudOrchestratorSetting({
    deployStatus: 'deploying',
    deployMessage: 'Despliegue en curso…',
  })

  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    GOOGLE_CLOUD_PROJECT_ID: creds.projectId,
    GOOGLE_CLOUD_LOCATION: creds.location,
    AGENT_ENGINE_STAGING_BUCKET: `gs://${creds.projectId}-agent-engine-staging`,
    ...(current.engineResource
      ? { DESIGN_AGENT_STUDIO_ENGINE: current.engineResource }
      : {}),
  }

  const script = deployScriptPath()
  const logs: string[] = []

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn('python3', ['-u', script], {
      cwd: projectRoot(),
      env,
    })
    child.stdout.on('data', (buf: Buffer) => {
      logs.push(buf.toString())
    })
    child.stderr.on('data', (buf: Buffer) => {
      logs.push(buf.toString())
    })
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })

  const combined = logs.join('')
  let engineResource =
    combined.match(/projects\/[^\s]+\/reasoningEngines\/[^\s]+/)?.[0] ?? ''

  if (!engineResource) {
    try {
      engineResource = (await readFile(deployLogPath(), 'utf8')).trim().split('\n')[0]?.trim() ?? ''
    } catch {
      /* log opcional */
    }
  }

  if (exitCode !== 0 || !engineResource) {
    const tail = combined.slice(-1200)
    await saveDesignCloudOrchestratorSetting({
      deployStatus: 'error',
      deployMessage: tail || `Deploy falló (código ${exitCode})`,
    })
    throw new Error(tail || `Deploy falló (código ${exitCode})`)
  }

  const setting = await saveDesignCloudOrchestratorSetting({
    engineResource,
    enabled: false,
    deployStatus: 'ready',
    deployMessage: 'Desplegado correctamente',
    lastDeployAt: new Date().toISOString(),
  })

  return { engineResource, setting }
}

async function deleteReasoningEngine(resource: string): Promise<void> {
  const creds = getVertexAICredentials()
  if (!creds) throw new Error('Vertex no configurado')
  const res = await vertexFetch(
    `https://${creds.location}-aiplatform.googleapis.com/v1/${resource}`,
    { method: 'DELETE' },
  )
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(text || `No se pudo eliminar ${resource}`)
  }
}

async function clearStagingBucket(bucketName: string): Promise<void> {
  const token = await getVertexBearerToken()
  const prefix = 'agent_engine/'
  let pageToken: string | undefined

  do {
    const url = new URL(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o`,
    )
    url.searchParams.set('prefix', prefix)
    url.searchParams.set('maxResults', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const listRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!listRes.ok) break

    const body = (await listRes.json()) as {
      items?: Array<{ name?: string }>
      nextPageToken?: string
    }
    for (const item of body.items ?? []) {
      if (!item.name) continue
      await fetch(
        `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(item.name)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      )
    }
    pageToken = body.nextPageToken
  } while (pageToken)
}

export async function undeployCloudOrchestrator(): Promise<void> {
  const creds = getVertexAICredentials()
  if (!creds?.projectId) {
    throw new Error('Vertex AI no configurado.')
  }

  const status = await getCloudOrchestratorStatus()
  const toDelete = new Set<string>()

  if (status.setting.engineResource) toDelete.add(status.setting.engineResource)
  for (const e of status.engines) toDelete.add(e.resource)

  for (const resource of toDelete) {
    await deleteReasoningEngine(resource)
  }

  if (status.stagingBucket) {
    await clearStagingBucket(status.stagingBucket)
  }

  await saveDesignCloudOrchestratorSetting({
    enabled: false,
    engineResource: null,
    deployStatus: 'idle',
    deployMessage: 'Recursos de Agent Engine eliminados',
    lastDeployAt: null,
  })
}

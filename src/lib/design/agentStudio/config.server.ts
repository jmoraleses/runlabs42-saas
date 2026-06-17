import 'server-only'

import { getVertexAICredentials } from '@/lib/ai/config.server'
import { trialBlocksDeployedAgentEngine } from '@/lib/ai/genaiAppBuilderTrial'
import { getVertexBearerToken } from '@/lib/ai/vertexAgentPlatform'
import {
  getDesignCloudOrchestratorSetting,
  invalidateDesignCloudOrchestratorCache,
  saveDesignCloudOrchestratorSetting,
} from '@/lib/platform/designCloudOrchestratorSetting.server'

const ENGINE_VERIFY_TTL_MS = 60_000
let engineVerifyCache: { resource: string; ok: boolean; expiresAt: number } | null = null

function normalizeEngineResource(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('projects/')) return trimmed

  const creds = getVertexAICredentials()
  if (!creds) return null
  return `projects/${creds.projectId}/locations/${creds.location}/reasoningEngines/${trimmed}`
}

function engineResourceFromEnv(): string | null {
  const full = process.env.DESIGN_AGENT_STUDIO_ENGINE?.trim()
  if (full) return normalizeEngineResource(full)

  const id = process.env.VERTEX_DESIGN_REASONING_ENGINE?.trim()
  if (!id) return null
  return normalizeEngineResource(id)
}

async function resolveEngineResourceCandidate(): Promise<string | null> {
  if (trialBlocksDeployedAgentEngine()) {
    const setting = await getDesignCloudOrchestratorSetting()
    if (setting.enabled && setting.engineResource) {
      return normalizeEngineResource(setting.engineResource)
    }
    return null
  }

  const setting = await getDesignCloudOrchestratorSetting()
  if (!setting.enabled) return null

  const fromSetting = normalizeEngineResource(setting.engineResource)
  if (fromSetting) return fromSetting

  return engineResourceFromEnv()
}

async function reasoningEngineExists(resource: string): Promise<boolean> {
  const now = Date.now()
  if (
    engineVerifyCache?.resource === resource &&
    engineVerifyCache.expiresAt > now
  ) {
    return engineVerifyCache.ok
  }

  const creds = getVertexAICredentials()
  if (!creds) {
    engineVerifyCache = { resource, ok: false, expiresAt: now + ENGINE_VERIFY_TTL_MS }
    return false
  }

  try {
    const token = await getVertexBearerToken()
    const res = await fetch(
      `https://${creds.location}-aiplatform.googleapis.com/v1/${resource}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const ok = res.ok
    engineVerifyCache = { resource, ok, expiresAt: now + ENGINE_VERIFY_TTL_MS }
    return ok
  } catch {
    engineVerifyCache = { resource, ok: false, expiresAt: now + ENGINE_VERIFY_TTL_MS }
    return false
  }
}

async function clearStaleOrchestratorSetting(reason: string): Promise<void> {
  console.warn(`[orchestration] ${reason}; orquestación in-process con Vertex`)
  await saveDesignCloudOrchestratorSetting({
    enabled: false,
    engineResource: null,
    deployStatus: 'idle',
    deployMessage: reason,
  })
  invalidateDesignCloudOrchestratorCache()
  engineVerifyCache = null
}

/** Resource name del reasoning engine cuando está activo y desplegado en GCP. */
export async function getDesignAgentStudioEngineResource(): Promise<string | null> {
  const candidate = await resolveEngineResourceCandidate()
  if (!candidate) return null

  if (await reasoningEngineExists(candidate)) return candidate

  await clearStaleOrchestratorSetting('Reasoning Engine no existe o no responde en GCP')
  return null
}

export async function isDesignAgentStudioEnabled(): Promise<boolean> {
  return (await getDesignAgentStudioEngineResource()) != null
}

export async function hasDesignAgentStudioEngineConfigured(): Promise<boolean> {
  const setting = await getDesignCloudOrchestratorSetting()
  if (setting.engineResource) return true
  return engineResourceFromEnv() != null
}

/** Limpia caché de verificación (tests / tras deploy). */
export function invalidateDesignAgentStudioEngineCache(): void {
  engineVerifyCache = null
}

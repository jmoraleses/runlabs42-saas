import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const saveDesignCloudOrchestratorSetting = vi.fn()
const getDesignCloudOrchestratorSetting = vi.fn()

vi.mock('@/lib/platform/designCloudOrchestratorSetting.server', () => ({
  getDesignCloudOrchestratorSetting: (...args: unknown[]) =>
    getDesignCloudOrchestratorSetting(...args),
  saveDesignCloudOrchestratorSetting: (...args: unknown[]) =>
    saveDesignCloudOrchestratorSetting(...args),
  invalidateDesignCloudOrchestratorCache: vi.fn(),
}))

vi.mock('@/lib/ai/config.server', () => ({
  getVertexAICredentials: () => ({
    projectId: 'runlabs42',
    location: 'us-central1',
  }),
}))

vi.mock('@/lib/ai/genaiAppBuilderTrial', () => ({
  trialBlocksDeployedAgentEngine: () => false,
}))

vi.mock('@/lib/ai/vertexAgentPlatform', () => ({
  getVertexBearerToken: vi.fn(async () => 'token'),
}))

import {
  getDesignAgentStudioEngineResource,
  invalidateDesignAgentStudioEngineCache,
  isDesignAgentStudioEnabled,
} from '@/lib/design/agentStudio/config.server'

describe('getDesignAgentStudioEngineResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateDesignAgentStudioEngineCache()
    saveDesignCloudOrchestratorSetting.mockImplementation(async (patch) => ({
      enabled: false,
      engineResource: null,
      deployStatus: 'idle',
      deployMessage: null,
      lastDeployAt: null,
      ...patch,
    }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    )
  })

  it('devuelve null y desactiva admin si el engine configurado no existe en GCP', async () => {
    getDesignCloudOrchestratorSetting.mockResolvedValue({
      enabled: true,
      engineResource:
        'projects/runlabs42/locations/us-central1/reasoningEngines/deleted',
      deployStatus: 'ready',
      deployMessage: null,
      lastDeployAt: null,
    })

    await expect(getDesignAgentStudioEngineResource()).resolves.toBeNull()
    await expect(isDesignAgentStudioEnabled()).resolves.toBe(false)

    expect(saveDesignCloudOrchestratorSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        engineResource: null,
      }),
    )
  })

  it('devuelve el resource cuando Vertex responde 200', async () => {
    const resource =
      'projects/runlabs42/locations/us-central1/reasoningEngines/123'
    getDesignCloudOrchestratorSetting.mockResolvedValue({
      enabled: true,
      engineResource: resource,
      deployStatus: 'ready',
      deployMessage: null,
      lastDeployAt: null,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    )

    await expect(getDesignAgentStudioEngineResource()).resolves.toBe(resource)
    expect(saveDesignCloudOrchestratorSetting).not.toHaveBeenCalled()
  })
})

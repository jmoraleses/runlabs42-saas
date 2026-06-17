import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/design/agentStudio/config.server', () => ({
  getDesignAgentStudioEngineResource: vi.fn(async () =>
    'projects/p/locations/us-central1/reasoningEngines/e1',
  ),
}))

describe('runDesignAgentOrchestration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('parsea respuesta de run_orchestration', async () => {
    vi.stubEnv('DESIGN_AGENT_STUDIO_ENGINE', 'projects/p/locations/us-central1/reasoningEngines/e1')
    vi.stubEnv('GOOGLE_CLOUD_PROJECT_ID', 'test-project')
    vi.stubEnv('GOOGLE_CLOUD_LOCATION', 'us-central1')

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          output: {
            events: [{ type: 'phase', data: 'visual-identity' }],
            tokens_json: '{"tokens":{}}',
            layout_json: '{"pages":[{"id":"home","name":"Inicio","sections":[]}]}',
            asset_plan_json: '{"assets":[]}',
            model_id: 'gemini-2.5-flash',
          },
        }),
    })
    vi.stubGlobal('fetch', fetchMock)

    vi.mock('@/lib/ai/config.server', () => ({
      getVertexAICredentials: () => ({
        projectId: 'test-project',
        location: 'us-central1',
      }),
    }))
    vi.mock('@/lib/ai/vertexAgentPlatform', () => ({
      getVertexBearerToken: async () => 'token-test',
    }))

    const { runDesignAgentOrchestration } = await import(
      '@/lib/design/agentStudio/runOrchestration'
    )
    const result = await runDesignAgentOrchestration({
      brief: { prompt: 'Tienda de tortugas' },
      modelId: 'gemini-2.5-flash',
    })

    expect(result.tokensJson).toContain('tokens')
    expect(result.layoutJson).toContain('pages')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(':query'),
      expect.objectContaining({
        body: expect.stringContaining('run_orchestration'),
      }),
    )
  })
})

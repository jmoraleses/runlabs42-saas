import { afterEach, describe, expect, it, vi } from 'vitest'

describe('genaiAppBuilderTrial', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('activa modo trial con USE_GENAI_APP_BUILDER_TRIAL_CREDIT=1', async () => {
    vi.stubEnv('USE_GENAI_APP_BUILDER_TRIAL_CREDIT', '1')
    const mod = await import('@/lib/ai/genaiAppBuilderTrial')
    expect(mod.isGenAiAppBuilderTrialCreditEnabled()).toBe(true)
    expect(mod.trialBlocksDeployedAgentEngine()).toBe(true)
    expect(mod.trialDisablesDesignImageGeneration()).toBe(true)
  })

  it('permite Agent Engine en trial si DESIGN_AGENT_STUDIO_ENGINE está definido', async () => {
    vi.stubEnv('USE_GENAI_APP_BUILDER_TRIAL_CREDIT', '1')
    vi.stubEnv('DESIGN_AGENT_STUDIO_ENGINE', 'projects/p/locations/us-central1/reasoningEngines/e1')
    const mod = await import('@/lib/ai/genaiAppBuilderTrial')
    expect(mod.trialBlocksDeployedAgentEngine()).toBe(false)
  })

  it('desactiva imágenes salvo DESIGN_IMAGE_GENERATION_ENABLED=1', async () => {
    vi.stubEnv('USE_GENAI_APP_BUILDER_TRIAL_CREDIT', '1')
    const mod = await import('@/lib/ai/genaiAppBuilderTrial')
    expect(mod.trialDisablesDesignImageGeneration()).toBe(true)
    vi.stubEnv('DESIGN_IMAGE_GENERATION_ENABLED', '1')
    expect(mod.trialDisablesDesignImageGeneration()).toBe(false)
  })
})

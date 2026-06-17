import { describe, expect, it } from 'vitest'
import {
  planModelsForPipeline,
  isMaxModelChoice,
  isAutoModelChoice,
} from '@/lib/ai/spec-kit/orchestrator'
import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/models'

describe('planModelsForPipeline', () => {
  it('uses flash-lite for constitution and tasks on simple prompts', async () => {
    const plan = await planModelsForPipeline({
      userPrompt: 'Crea un botón que diga hola',
      defaultModelId: 'gemini-2.5-flash-lite',
      geminiEnabled: true,
    })
    expect(plan.constitution).toBe('gemini-2.5-flash-lite')
    expect(plan.tasks).toBe('gemini-2.5-flash-lite')
    expect(plan.specify).toBe('gemini-2.5-flash')
  })

  it('uses pro for implement on complex architecture prompts', async () => {
    const plan = await planModelsForPipeline({
      userPrompt:
        'Arquitectura microservicios enterprise con multi-archivo, 6 features, refactor complejo y escalar el monorepo',
      defaultModelId: 'gemini-2.5-flash-lite',
      geminiEnabled: true,
    })
    expect(plan.implement).toBe('claude-opus-4-7')
  })

  it('returns default plan when gemini disabled', async () => {
    const plan = await planModelsForPipeline({
      userPrompt: 'test',
      defaultModelId: 'gemini-2.5-flash-lite',
      geminiEnabled: false,
    })
    expect(plan.constitution).toBe('gemini-2.5-flash-lite')
  })
})

describe('isMaxModelChoice', () => {
  it('detects max only', () => {
    expect(isMaxModelChoice(MAX_MODEL_ID)).toBe(true)
    expect(isMaxModelChoice(AUTO_MODEL_ID)).toBe(false)
    expect(isMaxModelChoice('gemini-2.5-flash')).toBe(false)
  })
})

describe('isAutoModelChoice', () => {
  it('detects auto but not max', () => {
    expect(isAutoModelChoice(AUTO_MODEL_ID)).toBe(true)
    expect(isAutoModelChoice(MAX_MODEL_ID)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  API_COST_SHARE_OF_CREDIT_VALUE,
  billableCreditAmount,
  creditsFromTokenUsage,
  CREDIT_PACKS_EUR,
  EUR_PER_CREDIT_RETAIL,
  estimateCreditsForRequest,
  usdCostFromUsage,
} from '@/lib/billing/tokenCredits'

describe('CREDIT_PACKS_EUR', () => {
  it('matches 15/40/80 euro packs', () => {
    expect(CREDIT_PACKS_EUR).toEqual([
      { eur: 15, credits: 100 },
      { eur: 40, credits: 250 },
      { eur: 80, credits: 500 },
    ])
  })
})

describe('creditsFromTokenUsage', () => {
  it('charges more credits for expensive output tokens', () => {
    const modelId = 'gemini-2.5-flash'
    const small = creditsFromTokenUsage(modelId, { inputTokens: 1_000, outputTokens: 500 })
    const large = creditsFromTokenUsage(modelId, { inputTokens: 1_000, outputTokens: 8_000 })
    expect(large).toBeGreaterThan(small)
    expect(small).toBeGreaterThan(0)
  })

  it('respects 80% margin via API budget share', () => {
    const usd = usdCostFromUsage('gemini-2.5-flash-lite', {
      inputTokens: 100_000,
      outputTokens: 50_000,
    })
    const credits = creditsFromTokenUsage('gemini-2.5-flash-lite', {
      inputTokens: 100_000,
      outputTokens: 50_000,
    })
    const apiBudgetEur = EUR_PER_CREDIT_RETAIL * API_COST_SHARE_OF_CREDIT_VALUE
    const expected = (usd / 0.92) / apiBudgetEur
    expect(credits).toBeCloseTo(Math.round(expected * 10) / 10, 1)
  })
})

describe('billableCreditAmount', () => {
  it('rounds up to integer minimum 1', () => {
    expect(billableCreditAmount(0)).toBe(0)
    expect(billableCreditAmount(0.2)).toBe(1)
    expect(billableCreditAmount(2.1)).toBe(3)
  })
})

describe('estimateCreditsForRequest', () => {
  it('scales with pipeline phases', () => {
    const one = estimateCreditsForRequest({
      modelId: 'gemini-2.5-flash',
      prompt: 'x'.repeat(4000),
      pipelinePhases: 1,
    })
    const five = estimateCreditsForRequest({
      modelId: 'gemini-2.5-flash',
      prompt: 'x'.repeat(4000),
      pipelinePhases: 5,
    })
    expect(five).toBeGreaterThan(one)
  })
})

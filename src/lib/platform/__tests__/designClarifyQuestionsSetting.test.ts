import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING,
  parseDesignClarifyQuestionsEnabled,
} from '@/lib/platform/designClarifyQuestionsSetting'

describe('parseDesignClarifyQuestionsEnabled', () => {
  it('devuelve true por defecto', () => {
    expect(DEFAULT_DESIGN_CLARIFY_QUESTIONS_SETTING.enabled).toBe(true)
    expect(parseDesignClarifyQuestionsEnabled(undefined)).toBe(true)
    expect(parseDesignClarifyQuestionsEnabled(null)).toBe(true)
  })

  it('lee enabled del objeto guardado', () => {
    expect(parseDesignClarifyQuestionsEnabled({ enabled: true })).toBe(true)
    expect(parseDesignClarifyQuestionsEnabled({ enabled: false })).toBe(false)
  })

  it('acepta boolean legacy', () => {
    expect(parseDesignClarifyQuestionsEnabled(true)).toBe(true)
    expect(parseDesignClarifyQuestionsEnabled(false)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  formatClarificationPromptBlock,
  parseDesignClarifyJson,
  shouldSkipDesignClarifyHeuristic,
} from '@/lib/design/designClarify'

describe('parseDesignClarifyJson', () => {
  it('parses fenced JSON with questions', () => {
    const raw = `\`\`\`json
{
  "questions": [
    {
      "id": "feat",
      "question": "¿Qué necesitas?",
      "allowMultiple": true,
      "options": [
        { "id": "a", "label": "Catálogo" },
        { "id": "b", "label": "Login" }
      ]
    }
  ]
}
\`\`\``
    const result = parseDesignClarifyJson(raw)
    expect(result.questions).toHaveLength(1)
    expect(result.questions[0]?.question).toBe('¿Qué necesitas?')
    expect(result.questions[0]?.allowMultiple).toBe(true)
    expect(result.questions[0]?.options).toHaveLength(2)
  })

  it('returns empty on invalid JSON', () => {
    expect(parseDesignClarifyJson('not json')).toEqual({ questions: [] })
  })
})

describe('formatClarificationPromptBlock', () => {
  it('formats answers into markdown block', () => {
    const questions = [
      {
        id: 'q1',
        question: '¿Audiencia?',
        options: [{ id: 'b2c', label: 'Consumidor final' }],
      },
    ]
    const block = formatClarificationPromptBlock(
      [{ questionId: 'q1', selectedOptionIds: ['b2c'] }],
      questions,
    )
    expect(block).toContain('Aclaraciones del usuario')
    expect(block).toContain('Consumidor final')
  })
})

describe('shouldSkipDesignClarifyHeuristic', () => {
  it('skips very long structured prompts', () => {
    const long = Array.from({ length: 50 }, (_, i) => `feature ${i} login admin`).join(' ')
    expect(shouldSkipDesignClarifyHeuristic(long)).toBe(true)
  })

  it('does not skip short vague prompts', () => {
    expect(shouldSkipDesignClarifyHeuristic('una tienda de coches')).toBe(false)
  })
})

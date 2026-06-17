import { describe, expect, it } from 'vitest'
import { resolvePipelinePhases } from '@/lib/ai/spec-kit/phases'

describe('resolvePipelinePhases', () => {
  it('omits implement for /plan', () => {
    expect(resolvePipelinePhases('/plan')).toEqual([
      'constitution',
      'specify',
      'plan',
      'tasks',
    ])
  })

  it('runs full pipeline for /build', () => {
    expect(resolvePipelinePhases('/build')).toContain('implement')
    expect(resolvePipelinePhases('/build').length).toBe(5)
  })

  it('stops at specify for /spec', () => {
    expect(resolvePipelinePhases('/spec')).toEqual(['constitution', 'specify'])
  })
})

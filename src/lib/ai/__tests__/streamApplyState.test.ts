import { describe, expect, it } from 'vitest'
import { streamFilesWereApplied } from '@/lib/ai/streamApplyState'

describe('streamFilesWereApplied', () => {
  it('is true when stream applied paths were recorded', () => {
    expect(
      streamFilesWereApplied({
        streamFilesAppliedFlag: false,
        streamAppliedPathsCount: 2,
        appliedTouchedCount: 0,
        alreadyInBuffers: false,
        updateOpsCount: 3,
      }),
    ).toBe(true)
  })

  it('is false when no apply signal and ops exist', () => {
    expect(
      streamFilesWereApplied({
        streamFilesAppliedFlag: false,
        streamAppliedPathsCount: 0,
        appliedTouchedCount: 0,
        alreadyInBuffers: false,
        updateOpsCount: 2,
      }),
    ).toBe(false)
  })

  it('is true when buffers already match model ops', () => {
    expect(
      streamFilesWereApplied({
        streamFilesAppliedFlag: false,
        streamAppliedPathsCount: 0,
        appliedTouchedCount: 0,
        alreadyInBuffers: true,
        updateOpsCount: 1,
      }),
    ).toBe(true)
  })
})

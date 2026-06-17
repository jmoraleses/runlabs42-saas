import { describe, expect, it } from 'vitest'
import { applyVisualPatch } from './applyVisualPatch'

const sample = `export function X() {
  return <h3>{plan.name}</h3>
}`

describe('applyVisualPatch', () => {
  it('returns unchanged when skId unknown', () => {
    const r = applyVisualPatch(sample, { skId: 'unknown', property: 'text', value: 'Hi' })
    expect(r.applied).toBe(false)
    expect(r.code).toBe(sample)
  })

  it('does not patch jsx expression placeholders', () => {
    const r = applyVisualPatch(sample, { skId: 'pricing-title', property: 'text', value: 'Pro' }, { previousText: 'Pro' })
    expect(r.applied).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { parseAutoRunBody } from '@/lib/auto/pipeline/runAutoPipeline'

describe('parseAutoRunBody', () => {
  it('defaults to stitch and variant count clamped', () => {
    const cfg = parseAutoRunBody({ niche: 'coffee shop', variantCount: 99 })
    expect(cfg.captureSource).toBe('stitch')
    expect(cfg.variantCount).toBe(12)
    expect(cfg.createStitchProject).toBe(true)
    expect(cfg.screenPrompts.length).toBeGreaterThan(3)
  })
})

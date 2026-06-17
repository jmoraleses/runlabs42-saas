import { describe, expect, it } from 'vitest'
import {
  parseAssetPlanFromModelText,
  formatPreGeneratedAssetsBlock,
} from '@/lib/design/orchestrationAssetsParse'

describe('parseAssetPlanFromModelText', () => {
  it('parses assets array', () => {
    const plan = parseAssetPlanFromModelText(
      '{"assets":[{"path":"assets/hero.jpg","prompt":"neon city","aspect":"16:9"}]}',
    )
    expect(plan?.assets).toHaveLength(1)
    expect(plan?.assets[0]?.path).toBe('assets/hero.jpg')
  })

  it('returns null for invalid payload', () => {
    expect(parseAssetPlanFromModelText('not json')).toBeNull()
  })
})

describe('formatPreGeneratedAssetsBlock', () => {
  it('lists image paths', () => {
    const block = formatPreGeneratedAssetsBlock([
      { path: 'assets/hero.jpg', content: 'base64', mimeType: 'image/jpeg' },
    ])
    expect(block).toContain('assets/hero.jpg')
    expect(block).toContain('pre-generados')
  })
})

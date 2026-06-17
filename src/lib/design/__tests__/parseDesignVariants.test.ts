import { describe, expect, it } from 'vitest'
import {
  parseDesignVariants,
  parseImageVariantPrompts,
} from '@/lib/design/parseDesignOutput'

describe('parseImageVariantPrompts', () => {
  it('parses strict fences with paths', () => {
    const text = `
\`\`\`json design/variants/v1/prompt.json
{ "imagePrompt": "Variant one minimal UI" }
\`\`\`
\`\`\`json design/variants/v2/prompt.json
{ "imagePrompt": "Variant two bold UI" }
\`\`\`
`
    const prompts = parseImageVariantPrompts(text)
    expect(prompts).toHaveLength(2)
    expect(prompts[0]).toMatchObject({ variantId: 'v1', imagePrompt: 'Variant one minimal UI' })
  })

  it('falls back to loose imagePrompt fields', () => {
    const text = `Aquí van las variantes:
{ "imagePrompt": "Loose variant A" }
y otra:
{ "imagePrompt": "Loose variant B" }`
    const prompts = parseImageVariantPrompts(text)
    expect(prompts.length).toBeGreaterThanOrEqual(2)
    expect(prompts[0]?.imagePrompt).toContain('Loose variant')
  })
})

describe('parseDesignVariants', () => {
  it('parses html variant blocks', () => {
    const text = `
\`\`\`html design/variants/v1/index.html
<!DOCTYPE html><html><body style="background:#111">V1</body></html>
\`\`\`
\`\`\`html design/variants/v2/index.html
<!DOCTYPE html><html><body style="background:#eee">V2</body></html>
\`\`\`
`
    const variants = parseDesignVariants(text)
    expect(variants).toHaveLength(2)
    expect(variants[0]?.path).toBe('design/variants/v1/index.html')
  })

  it('falls back to html fences without explicit paths', () => {
    const text = `
\`\`\`html
<!DOCTYPE html><html><body><h1>Variant A</h1></body></html>
\`\`\`
\`\`\`html
<!DOCTYPE html><html><body><h1>Variant B</h1></body></html>
\`\`\`
`
    const variants = parseDesignVariants(text)
    expect(variants.length).toBeGreaterThanOrEqual(2)
    expect(variants[0]?.path).toMatch(/^design\/variants\/v\d+\/index\.html$/)
  })
})

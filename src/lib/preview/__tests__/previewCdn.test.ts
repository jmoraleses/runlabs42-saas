import { describe, expect, it } from 'vitest'
import { buildPreviewCdnScriptTags } from '@/lib/preview/previewCdn'

describe('buildPreviewCdnScriptTags', () => {
  it('includes Phaser CDN when source imports phaser', () => {
    const tags = buildPreviewCdnScriptTags("import Phaser from 'phaser'")
    expect(tags).toContain('phaser')
  })

  it('includes Three CDN when source imports three', () => {
    const tags = buildPreviewCdnScriptTags("import * as THREE from 'three'")
    expect(tags).toContain('three')
  })

  it('includes p5 when sketch imports p5', () => {
    const tags = buildPreviewCdnScriptTags("import p5 from 'p5'")
    expect(tags).toMatch(/p5\.js/)
  })
})

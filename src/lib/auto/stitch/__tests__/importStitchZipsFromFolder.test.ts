import { describe, expect, it } from 'vitest'
import { stitchPageAssetDir } from '@/lib/auto/stitch/importStitchZipsFromFolder'

describe('importStitchZipsFromFolder', () => {
  it('stitchPageAssetDir coloca assets de home bajo design/site/', () => {
    expect(stitchPageAssetDir('home')).toBe('design/site/')
    expect(stitchPageAssetDir('index')).toBe('design/site/')
    expect(stitchPageAssetDir('catalogue')).toBe('design/pages/catalogue/')
  })
})

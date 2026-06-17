import { describe, expect, it } from 'vitest'
import { picsumPhotoUrlForDesignAsset } from '@/lib/design/previewPicsum'

describe('picsumPhotoUrlForDesignAsset', () => {
  it('genera URL determinista por ruta', () => {
    const a = picsumPhotoUrlForDesignAsset('design/site/hero-yoga.jpg')
    const b = picsumPhotoUrlForDesignAsset('design/site/hero-yoga.jpg')
    expect(a).toBe(b)
    expect(a).toContain('picsum.photos/seed/')
    expect(a).toContain('1200')
  })

  it('usa tamaño cuadrado para avatares', () => {
    const url = picsumPhotoUrlForDesignAsset('design/site/avatar-ana.jpg')
    expect(url).toContain('/400/400')
  })
})

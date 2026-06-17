import { describe, expect, it } from 'vitest'
import {
  buildPlaceholderAssetFilesForHtml,
  designAssetReadyPathsFromExisting,
  designImagePlaceholdersForFiles,
  filterPersistableDesignFiles,
  isPersistableDesignFileContent,
} from '@/lib/design/designAssetPlaceholders'

describe('buildPlaceholderAssetFilesForHtml', () => {
  it('creates placeholders for local img src not yet on disk', () => {
    const html = `<img src="assets/hero-cactus.jpg" alt="Cactus">`
    const files = buildPlaceholderAssetFilesForHtml(
      [{ path: 'design/site/index.html', content: html }],
      new Set(),
    )
    expect(files).toHaveLength(1)
    expect(files[0]?.path).toBe('design/site/assets/hero-cactus.jpg')
    expect(files[0]?.content.length).toBeGreaterThan(100)
  })

  it('maps absolute /images/ src to design/site/images/', () => {
    const html = `<img src="/images/hero-yoga-pose.jpg" alt="Hero">`
    const files = buildPlaceholderAssetFilesForHtml(
      [{ path: 'design/site/index.html', content: html }],
      new Set(),
    )
    expect(files[0]?.path).toBe('design/site/images/hero-yoga-pose.jpg')
  })

  it('creates SVG placeholder for logo paths', () => {
    const html = `<img src="/images/logo.svg" alt="Logo">`
    const files = buildPlaceholderAssetFilesForHtml(
      [{ path: 'design/site/home.html', content: html }],
      new Set(),
    )
    expect(files).toHaveLength(1)
    expect(files[0]?.path).toBe('design/site/images/logo.svg')
    expect(files[0]?.content).toContain('<svg')
  })

  it('skips paths already accumulated', () => {
    const html = `<img src="assets/hero-cactus.jpg" alt="Cactus">`
    const files = buildPlaceholderAssetFilesForHtml(
      [{ path: 'design/site/index.html', content: html }],
      new Set(['design/site/assets/hero-cactus.jpg']),
    )
    expect(files).toHaveLength(0)
  })
})

describe('designImagePlaceholdersForFiles with existing assets', () => {
  it('does not placeholder assets already on disk from another page', () => {
    const homeHtml = `<img src="assets/hero.jpg" alt="Hero">`
    const catalogHtml = `<img src="assets/product.jpg" alt="Product">`
    const existing = [
      { path: 'design/site/assets/hero.jpg', content: 'realHeroBase64' },
      { path: 'design/pages/catalog/assets/product.jpg', content: 'realProductBase64' },
    ]
    const ready = designAssetReadyPathsFromExisting(existing)
    const placeholders = designImagePlaceholdersForFiles(
      [
        { path: 'design/site/index.html', content: homeHtml },
        { path: 'design/pages/catalog/index.html', content: catalogHtml },
      ],
      ready,
    )
    expect(placeholders).toHaveLength(0)
  })
})

describe('filterPersistableDesignFiles', () => {
  it('drops empty raster payloads so partial regen does not wipe assets', () => {
    expect(
      isPersistableDesignFileContent('design/site/assets/hero.jpg', ''),
    ).toBe(false)
    const kept = filterPersistableDesignFiles([
      { path: 'design/site/assets/hero.jpg', content: '' },
      { path: 'design/pages/home/index.html', content: '<p>ok</p>' },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]?.path).toBe('design/pages/home/index.html')
  })
})

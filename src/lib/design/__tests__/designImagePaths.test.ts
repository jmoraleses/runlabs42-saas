import { describe, expect, it } from 'vitest'
import {
  expectedDesignPageImagePaths,
  parseDesignImagePathsFromHtml,
  shouldShowMockupAssetGradient,
} from '@/lib/design/designImagePaths'

describe('parseDesignImagePathsFromHtml', () => {
  it('resolves relative img src against page html path', () => {
    const html = '<img src="assets/hero.jpg" alt="Hero">'
    const paths = parseDesignImagePathsFromHtml(html, 'design/pages/home/index.html')
    expect(paths).toEqual(['design/pages/home/assets/hero.jpg'])
  })

  it('skips external urls', () => {
    const html = '<img src="https://cdn.example.com/x.jpg">'
    expect(parseDesignImagePathsFromHtml(html, 'design/pages/home/index.html')).toEqual([])
  })
})

describe('mockup asset gradient', () => {
  const htmlPath = 'design/pages/home/index.html'
  const html = '<img src="assets/hero.jpg" alt="Hero">'

  it('lists expected local image paths from html', () => {
    const paths = expectedDesignPageImagePaths(html, htmlPath)
    expect(paths).toContain('design/pages/home/assets/hero.jpg')
  })

  it('hides gradient when all expected images are ready', () => {
    const expected = expectedDesignPageImagePaths(html, htmlPath)
    const ready = new Set(expected)
    expect(shouldShowMockupAssetGradient(expected, ready, true)).toBe(false)
  })

  it('shows gradient while images are pending during generation', () => {
    const expected = expectedDesignPageImagePaths(html, htmlPath)
    expect(shouldShowMockupAssetGradient(expected, new Set(), true)).toBe(true)
    expect(shouldShowMockupAssetGradient(expected, new Set(), false)).toBe(false)
  })
})

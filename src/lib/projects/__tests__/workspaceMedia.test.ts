import { describe, expect, it } from 'vitest'
import {
  isImageWorkspacePath,
  publicUrlFromWorkspacePath,
  workspaceImageDataUrl,
} from '@/lib/projects/workspaceMedia'

describe('workspaceMedia', () => {
  it('detects image paths', () => {
    expect(isImageWorkspacePath('public/images/hero.jpg')).toBe(true)
    expect(isImageWorkspacePath('src/App.tsx')).toBe(false)
  })

  it('maps public folder paths to URL', () => {
    expect(publicUrlFromWorkspacePath('public/images/hero.jpg')).toBe('/images/hero.jpg')
  })

  it('wraps raw base64 as data url', () => {
    const url = workspaceImageDataUrl('public/images/a.png', 'YWJj')
    expect(url).toBe('data:image/png;base64,YWJj')
  })
})

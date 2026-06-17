import { describe, expect, it } from 'vitest'
import { getScaffold } from '@/lib/scaffolds'
import { CANVAS_FRAMEWORKS } from '@/lib/scaffolds/types'

describe('canvas scaffolds', () => {
  for (const fw of CANVAS_FRAMEWORKS) {
    it(`${fw} includes viewport meta and entry HTML`, () => {
      const files = getScaffold(fw, 'Test')
      const html = files.find((f) => f.path === 'index.html')
      expect(html?.content).toMatch(/viewport/)
      expect(html?.content).toMatch(/<!DOCTYPE html>/i)
    })
  }

  it('canvas-app includes drawing toolbar', () => {
    const files = getScaffold('canvas-app', 'Draw')
    expect(files.some((f) => f.path === 'app.js')).toBe(true)
    expect(files.find((f) => f.path === 'index.html')?.content).toContain('drawCanvas')
  })

  it('phaser loads CDN', () => {
    const html = getScaffold('phaser', 'Game').find((f) => f.path === 'index.html')?.content ?? ''
    expect(html).toContain('phaser')
  })

  it('three loads CDN', () => {
    const html = getScaffold('three', 'Scene').find((f) => f.path === 'index.html')?.content ?? ''
    expect(html).toContain('three')
  })
})

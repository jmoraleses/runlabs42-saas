import { describe, expect, it } from 'vitest'
import { buildInsertPrompt } from '@/lib/visual-edit/buildInsertPrompt'
import type { ElementDescriptor, InsertPlacementContext } from '@/lib/visual-edit/protocol'

const baseRect = { top: 0, left: 0, width: 100, height: 40 }

describe('buildInsertPrompt', () => {
  it('includes placement context for AI', () => {
    const placement: InsertPlacementContext = {
      kind: 'text',
      skId: 'sk-new1',
      parentSkId: 'sk-parent',
      parentTag: 'main',
      insertBeforeSkId: 'sk-sibling',
      dropXPercent: 42,
      dropYPercent: 67,
    }
    const created: ElementDescriptor = {
      skId: 'sk-new1',
      tagName: 'p',
      rect: baseRect,
      text: 'Nuevo texto',
      styles: {},
    }
    const prompt = buildInsertPrompt(placement, created)
    expect(prompt).toContain('sk-new1')
    expect(prompt).toContain('sk-parent')
    expect(prompt).toContain('sk-sibling')
    expect(prompt).toContain('42% horizontal')
    expect(prompt).toContain('párrafo de texto')
  })
})

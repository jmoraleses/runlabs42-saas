import { describe, expect, it } from 'vitest'
import { insertKindToTool, toolToInsertKind } from '@/components/editor/CanvasToolRail'

describe('CanvasToolRail helpers', () => {
  it('maps insert tools to kinds and back', () => {
    expect(toolToInsertKind('insert-heading')).toBe('heading')
    expect(insertKindToTool('heading')).toBe('insert-heading')
    expect(toolToInsertKind('select')).toBeNull()
  })
})

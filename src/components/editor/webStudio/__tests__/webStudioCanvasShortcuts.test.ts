import { describe, expect, it } from 'vitest'
import { canvasToolFromShortcutKey } from '@/components/editor/webStudio/webStudioCanvasShortcuts'

describe('canvasToolFromShortcutKey', () => {
  it('maps design-tool letter shortcuts', () => {
    expect(canvasToolFromShortcutKey('v')).toBe('select')
    expect(canvasToolFromShortcutKey('V')).toBe('select')
    expect(canvasToolFromShortcutKey('h')).toBe('pan')
    expect(canvasToolFromShortcutKey('e')).toBe('edit')
    expect(canvasToolFromShortcutKey('r')).toBe('rect')
    expect(canvasToolFromShortcutKey('i')).toBe('image')
    expect(canvasToolFromShortcutKey('p')).toBe('palette')
  })

  it('returns null for unknown keys', () => {
    expect(canvasToolFromShortcutKey('x')).toBeNull()
    expect(canvasToolFromShortcutKey('')).toBeNull()
  })
})

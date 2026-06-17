import { describe, expect, it } from 'vitest'
import {
  assistantResponseInProgress,
  fileOperationsFromSegments,
  parseAssistantSegments,
  parseFileOperationsFromStream,
} from '@/lib/ai/parseAssistantOutput'

describe('parseAssistantOutput', () => {
  it('parses fence with path in info string', () => {
    const text = 'Hello\n\n```tsx src/App.tsx\nexport const x = 1\n```\n'
    const segments = parseAssistantSegments(text)
    expect(segments.some((s) => s.kind === 'code' && s.path === 'src/App.tsx')).toBe(true)
    const ops = parseFileOperationsFromStream(text)
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ type: 'create', path: 'src/App.tsx', content: 'export const x = 1' })
  })

  it('marks incomplete fence as not complete', () => {
    const text = '```tsx src/App.tsx\nconst a = 1'
    const segments = parseAssistantSegments(text)
    const code = segments.find((s) => s.kind === 'code')
    expect(code?.complete).toBe(false)
    expect(fileOperationsFromSegments(segments)).toHaveLength(0)
  })

  it('parses root-level html and json paths without slash', () => {
    const text = [
      '```html index.html',
      '<!DOCTYPE html><html><body>Hola</body></html>',
      '```',
      '',
      '```json public/manifest.json',
      '{"name":"Demo"}',
      '```',
      '',
      '```tsx src/App.tsx',
      'export default function App() { return <h1>Hola</h1> }',
      '```',
    ].join('\n')

    const ops = parseFileOperationsFromStream(text)
    expect(ops).toHaveLength(3)
    expect(ops.map((o) => o.path).sort()).toEqual([
      'index.html',
      'public/manifest.json',
      'src/App.tsx',
    ])
  })

  it('parses single-segment json manifest at project root', () => {
    const text = '```json manifest.json\n{"name":"x"}\n```\n'
    const ops = parseFileOperationsFromStream(text)
    expect(ops).toHaveLength(1)
    expect(ops[0]?.path).toBe('manifest.json')
  })

  it('maps root App.tsx to src/App.tsx when src/App.tsx exists', () => {
    const text = '```tsx App.tsx\nexport default () => <main />\n```\n'
    const ops = parseFileOperationsFromStream(text, {
      existingPaths: ['src/App.tsx', 'src/main.tsx'],
    })
    expect(ops[0]?.path).toBe('src/App.tsx')
  })

  it('does not merge distinct files into defaultPath', () => {
    const text = [
      '```html index.html',
      '<html></html>',
      '```',
      '```tsx src/App.tsx',
      'export default () => null',
      '```',
    ].join('\n')
    const ops = parseFileOperationsFromStream(text, { defaultPath: 'src/App.tsx' })
    expect(ops).toHaveLength(2)
    expect(new Set(ops.map((o) => o.path)).size).toBe(2)
  })

  it('assistantResponseInProgress detects empty and open fences', () => {
    expect(assistantResponseInProgress('')).toBe(true)
    expect(assistantResponseInProgress('```tsx src/App.tsx\nconst a = 1')).toBe(true)
    expect(
      assistantResponseInProgress('```tsx src/App.tsx\nconst a = 1\n```'),
    ).toBe(false)
  })
})

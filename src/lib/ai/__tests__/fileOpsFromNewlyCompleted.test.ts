import { describe, expect, it } from 'vitest'
import { fileOpsFromNewlyCompletedSegments } from '@/lib/ai/parseAssistantOutput'

describe('fileOpsFromNewlyCompletedSegments', () => {
  it('returns op when a fence closes between snapshots', () => {
    const prev = '```tsx src/App.tsx\nexport const a = 1'
    const next = '```tsx src/App.tsx\nexport const a = 1\n```\n'
    const ops = fileOpsFromNewlyCompletedSegments(prev, next)
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ path: 'src/App.tsx', content: 'export const a = 1' })
  })

  it('returns only newly closed files when a second fence completes', () => {
    const prev = ['```tsx src/App.tsx', 'export default () => null', '```', ''].join('\n')
    const next = [
      '```tsx src/App.tsx',
      'export default () => null',
      '```',
      '',
      '```css src/styles/app.css',
      'body { margin: 0 }',
      '```',
    ].join('\n')
    const ops = fileOpsFromNewlyCompletedSegments(prev, next)
    expect(ops).toHaveLength(1)
    expect(ops[0]?.path).toBe('src/styles/app.css')
  })

  it('returns empty when no new complete blocks', () => {
    const text = '```tsx src/App.tsx\nconst x = 1'
    expect(fileOpsFromNewlyCompletedSegments(text, text)).toHaveLength(0)
  })
})

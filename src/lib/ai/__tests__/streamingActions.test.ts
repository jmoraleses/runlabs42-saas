import { describe, expect, it } from 'vitest'
import {
  parseAssistantSegments,
  streamingActionsFromSegments,
} from '@/lib/ai/parseAssistantOutput'

describe('streamingActionsFromSegments', () => {
  it('marks an open fence as writing and a closed one as done', () => {
    const writing = streamingActionsFromSegments(
      parseAssistantSegments('```tsx src/App.tsx\nconst a = 1'),
    )
    expect(writing).toHaveLength(1)
    expect(writing[0]).toMatchObject({ path: 'src/App.tsx', status: 'writing' })

    const done = streamingActionsFromSegments(
      parseAssistantSegments('```tsx src/App.tsx\nconst a = 1\n```'),
    )
    expect(done[0]).toMatchObject({ path: 'src/App.tsx', status: 'done' })
  })

  it('dedupes by path keeping the latest state', () => {
    const text = [
      '```tsx src/App.tsx',
      'v1',
      '```',
      '```tsx src/App.tsx',
      'v2-incompleto',
    ].join('\n')
    const actions = streamingActionsFromSegments(parseAssistantSegments(text))
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ path: 'src/App.tsx', status: 'writing' })
  })

  it('uses the default path when the fence has no path', () => {
    const actions = streamingActionsFromSegments(
      parseAssistantSegments('```tsx\nconst a = 1\n```'),
      { defaultPath: 'src/Main.tsx' },
    )
    expect(actions[0]?.path).toBe('src/Main.tsx')
  })

  it('tracks several files independently', () => {
    const text = [
      '```tsx src/App.tsx',
      'export default function App(){return null}',
      '```',
      '```css src/styles.css',
      '.x{color:red}',
    ].join('\n')
    const actions = streamingActionsFromSegments(parseAssistantSegments(text))
    expect(actions.map((a) => `${a.path}:${a.status}`).sort()).toEqual([
      'src/App.tsx:done',
      'src/styles.css:writing',
    ])
  })
})

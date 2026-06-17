import { describe, expect, it } from 'vitest'
import { buildChatAppliedFiles } from '@/lib/chat/appliedFiles'

describe('buildChatAppliedFiles', () => {
  it('marks new paths as create and existing as update', () => {
    const files = buildChatAppliedFiles(
      [
        { type: 'update', path: 'src/App.tsx', content: 'export default function App() {}' },
        { type: 'create', path: 'src/pages/Home.tsx', content: 'export default function Home() {}' },
      ],
      {
        pathsBefore: new Set(['src/App.tsx']),
        buffers: {
          'src/App.tsx': { content: 'export default function App() {}' },
          'src/pages/Home.tsx': { content: 'export default function Home() {}' },
        },
      },
    )
    expect(files.find((f) => f.path === 'src/App.tsx')?.action).toBe('update')
    expect(files.find((f) => f.path === 'src/pages/Home.tsx')?.action).toBe('create')
  })
})

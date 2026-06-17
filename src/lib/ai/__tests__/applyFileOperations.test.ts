import { describe, expect, it } from 'vitest'
import { fileOpsMatchBuffers, type WorkspaceBuffers } from '@/lib/ai/applyFileOperations'
import type { FileOperation } from '@/lib/ai/fileOperations'

describe('fileOpsMatchBuffers', () => {
  const buffers: WorkspaceBuffers = {
    'src/App.tsx': { content: 'export default function App() {}', dirty: false, language: 'typescript' },
  }

  it('returns true when buffer content matches update ops', () => {
    const ops: FileOperation[] = [
      { type: 'update', path: 'src/App.tsx', content: 'export default function App() {}' },
    ]
    expect(fileOpsMatchBuffers(buffers, ops)).toBe(true)
  })

  it('returns false when content differs', () => {
    const ops: FileOperation[] = [
      { type: 'update', path: 'src/App.tsx', content: 'export default function App() { return null }' },
    ]
    expect(fileOpsMatchBuffers(buffers, ops)).toBe(false)
  })

  it('ignores delete-only ops', () => {
    const ops: FileOperation[] = [{ type: 'delete', path: 'src/App.tsx' }]
    expect(fileOpsMatchBuffers(buffers, ops)).toBe(false)
  })
})

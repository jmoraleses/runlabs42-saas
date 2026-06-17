import { describe, expect, it } from 'vitest'
import { cleanStreamFileOps } from '@/hooks/useWorkspaceBuffers'
import type { FileOperation } from '@/lib/ai/fileOperations'

describe('cleanStreamFileOps', () => {
  const appOp: FileOperation = {
    type: 'update',
    path: 'src/App.tsx',
    content: 'export default function App() { return null }',
  }

  it('does not add preview entry files by default', () => {
    const ops = cleanStreamFileOps([appOp], [])
    expect(ops.map((o) => o.path)).toEqual(['src/App.tsx'])
  })

  it('adds preview entry files when addPreviewEntries is true', () => {
    const ops = cleanStreamFileOps([appOp], [], { addPreviewEntries: true })
    const paths = ops.map((o) => o.path)
    expect(paths).toContain('src/App.tsx')
    expect(paths).toContain('index.html')
    expect(paths).toContain('src/main.tsx')
  })

  it('can skip preview entry files explicitly', () => {
    const ops = cleanStreamFileOps([appOp], [], { addPreviewEntries: false })
    expect(ops.map((o) => o.path)).toEqual(['src/App.tsx'])
  })
})

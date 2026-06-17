import { describe, expect, it } from 'vitest'
import { previewEntryFileOps } from '@/lib/projects/ensurePreviewEntryFiles'

describe('previewEntryFileOps', () => {
  it('adds main, index.html and blank App when project is empty', () => {
    const ops = previewEntryFileOps([])
    expect(ops.map((o) => o.path).sort()).toEqual([
      'index.html',
      'src/App.tsx',
      'src/main.tsx',
    ])
    const appOp = ops.find((o) => o.path === 'src/App.tsx')
    expect(appOp?.type).not.toBe('delete')
    expect(appOp && appOp.type !== 'delete' ? appOp.content : '').toContain('data-sk-id="sk-page"')
  })

  it('adds main.tsx and index.html when only App exists', () => {
    const ops = previewEntryFileOps(['src/App.tsx', 'src/App.css'])
    expect(ops.map((o) => o.path).sort()).toEqual(['index.html', 'src/main.tsx'])
  })

  it('adds App.tsx when main exists but App is missing', () => {
    const ops = previewEntryFileOps(['src/main.tsx', 'index.html'])
    expect(ops).toHaveLength(1)
    const appOp = ops[0]
    expect(appOp?.path).toBe('src/App.tsx')
    expect(appOp?.type).toBe('create')
    expect(appOp && appOp.type !== 'delete' ? appOp.content : '').toContain('export default function App')
  })

  it('returns empty when entry files already exist', () => {
    expect(
      previewEntryFileOps(['src/App.tsx', 'src/main.tsx', 'index.html']),
    ).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import {
  isMissingEntryError,
  parseCompileError,
  snippetAroundLine,
} from '@/lib/preview/parseCompileError'

describe('parseCompileError', () => {
  const known = ['src/App.tsx', 'src/main.tsx', 'src/App.css']

  it('extracts path and line from esbuild location', () => {
    const err = `✘ [ERROR] Expected "}" but found end of file
  src/App.tsx:18:10:
    18 │   return (
       │           ^`
    const p = parseCompileError(err, known)
    expect(p.primaryPath).toBe('src/App.tsx')
    expect(p.line).toBe(18)
    expect(p.targetPaths).toContain('src/App.tsx')
  })

  it('extracts importer from resolve errors', () => {
    const err = 'Could not resolve "./App.css" from src/App.tsx'
    const p = parseCompileError(err, known)
    expect(p.targetPaths).toContain('src/App.tsx')
  })

  it('resolves missing module from main.tsx import (Spanish)', () => {
    const err = 'No se puede resolver "./App" desde src/main.tsx'
    const p = parseCompileError(err, ['src/main.tsx', 'index.html'])
    expect(p.targetPaths).toContain('src/App.tsx')
    expect(p.targetPaths).toContain('src/main.tsx')
  })

  it('resolves missing module from main.tsx import (English)', () => {
    const err = 'Could not resolve "./App" from src/main.tsx'
    const p = parseCompileError(err, ['src/main.tsx', 'index.html'])
    expect(p.targetPaths).toContain('src/App.tsx')
    expect(p.targetPaths).toContain('src/main.tsx')
  })

  it('detects missing entry message', () => {
    expect(isMissingEntryError('No se encontró un punto de entrada (src/main.tsx).')).toBe(
      true,
    )
  })

  it('treats missing ./App resolve as missing entry bootstrap', () => {
    expect(isMissingEntryError('No se pudo resolver "./App" desde src/main.tsx')).toBe(true)
  })
})

describe('snippetAroundLine', () => {
  it('marks the error line', () => {
    const content = 'a\nb\nc\nd\ne\n'
    const snip = snippetAroundLine(content, 3, 1)
    expect(snip).toContain('>    3 |')
    expect(snip).toContain('c')
  })
})

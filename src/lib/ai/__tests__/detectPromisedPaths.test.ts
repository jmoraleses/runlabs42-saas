import { describe, expect, it } from 'vitest'
import {
  detectUndeliveredFilePaths,
  extractMentionedFilePaths,
} from '@/lib/ai/detectPromisedPaths'

describe('extractMentionedFilePaths', () => {
  it('extracts paths from numbered lists', () => {
    const text = `
1. index.html (SOBRESCRIBE)
4. src/context/ThemeContext.tsx Maneja el tema
7. src/pages/TodoList.tsx Lista
`
    const paths = extractMentionedFilePaths(text)
    expect(paths).toContain('index.html')
    expect(paths).toContain('src/context/ThemeContext.tsx')
    expect(paths).toContain('src/pages/TodoList.tsx')
  })

  it('ignores non-file tokens', () => {
    const text = 'Instala uuid con npm'
    expect(extractMentionedFilePaths(text)).toEqual([])
  })
})

describe('detectUndeliveredFilePaths', () => {
  it('returns mentioned paths not in delivered set', () => {
    const text = `
1. index.html
2. src/App.tsx
3. src/pages/TodoList.tsx
`
    const undelivered = detectUndeliveredFilePaths(text, ['index.html', 'src/App.tsx'])
    expect(undelivered).toEqual(['src/pages/TodoList.tsx'])
  })
})

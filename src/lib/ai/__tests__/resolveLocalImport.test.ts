import { describe, expect, it } from 'vitest'
import {
  detectMissingLocalImports,
  resolveLocalImportSpec,
} from '@/lib/ai/resolveLocalImport'

describe('resolveLocalImportSpec', () => {
  it('resolves relative imports from src/App.tsx', () => {
    expect(
      resolveLocalImportSpec('./pages/Home', 'src/App.tsx', ['src/App.tsx']),
    ).toBe('src/pages/Home.tsx')
  })

  it('resolves context imports', () => {
    expect(
      resolveLocalImportSpec('./context/AuthContext', 'src/App.tsx', ['src/App.tsx']),
    ).toBe('src/context/AuthContext.tsx')
  })
})

describe('detectMissingLocalImports', () => {
  it('reports missing modules imported from App', () => {
    const app = `import Home from './pages/Home'
import { AuthProvider } from './context/AuthContext'
export default function App() { return null }`
    const missing = detectMissingLocalImports([
      { path: 'src/App.tsx', content: app },
      { path: 'src/main.tsx', content: "import App from './App'" },
    ])
    expect(missing.map((m) => m.path).sort()).toEqual([
      'src/context/AuthContext.tsx',
      'src/pages/Home.tsx',
    ])
    expect(missing[0]?.importedFrom).toContain('src/App.tsx')
  })

  it('returns empty when all imports exist', () => {
    const missing = detectMissingLocalImports([
      { path: 'src/App.tsx', content: "import Home from './pages/Home'" },
      { path: 'src/pages/Home.tsx', content: 'export default function Home() { return null }' },
    ])
    expect(missing).toEqual([])
  })
})

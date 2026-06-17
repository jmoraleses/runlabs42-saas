import { describe, expect, it } from 'vitest'
import {
  normalizeJsxStringStyleAttrs,
  normalizePreviewModuleSource,
} from '@/lib/preview/normalizePreviewExports'

describe('normalizePreviewModuleSource', () => {
  it('adds default export for named component matching filename', () => {
    const src = 'export function Landing() { return null }'
    const out = normalizePreviewModuleSource(src, 'src/pages/Landing.tsx')
    expect(out).toContain('export default Landing')
  })

  it('does not duplicate when default already exists', () => {
    const src = 'export default function Landing() { return null }'
    const out = normalizePreviewModuleSource(src, 'src/pages/Landing.tsx')
    expect(out).toBe(src)
  })

  it('adds default export for function App without export keyword', () => {
    const src = `import { BrowserRouter } from 'react-router-dom'
function App() { return <BrowserRouter /> }`
    const out = normalizePreviewModuleSource(src, 'src/App.tsx')
    expect(out).toContain('export default App')
  })

  it('strips embedded createRoot from App.tsx', () => {
    const src = `function App() { return <div /> }
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);`
    const out = normalizePreviewModuleSource(src, 'src/App.tsx')
    expect(out).not.toContain('createRoot')
    expect(out).toContain('export default App')
  })
})

describe('normalizeJsxStringStyleAttrs', () => {
  it('convierte style string a objeto JSX', () => {
    const src = '<div style="min-height:48px;padding:12px"></div>'
    expect(normalizeJsxStringStyleAttrs(src)).toBe(
      "<div style={{ minHeight: '48px', padding: '12px' }}></div>",
    )
  })

  it('no altera style={{ }} existente', () => {
    const src = "<div style={{ color: 'red' }}></div>"
    expect(normalizeJsxStringStyleAttrs(src)).toBe(src)
  })
})

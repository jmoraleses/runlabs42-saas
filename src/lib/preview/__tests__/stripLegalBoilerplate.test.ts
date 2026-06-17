import { describe, expect, it } from 'vitest'
import {
  filesForStudioPreview,
  stripLegalBoilerplateFromContent,
  stripLegalBoilerplateFromFiles,
} from '@/lib/preview/stripLegalBoilerplate'

describe('stripLegalBoilerplate', () => {
  it('removes footer links from App.tsx', () => {
    const src = `export default function App() {
  return (
    <div>
      <h1>Hola</h1>
      <footer>
        <a href="/privacy">Política de Privacidad</a>
        <a href="/terms">Términos de Servicio</a>
      </footer>
    </div>
  )
}`
    const out = stripLegalBoilerplateFromContent('src/App.tsx', src)
    expect(out).not.toMatch(/privacidad|términos|privacy|terms/i)
    expect(out).toContain('<h1>Hola</h1>')
  })

  it('drops Privacy and Terms page files', () => {
    const files = stripLegalBoilerplateFromFiles([
      { path: 'src/App.tsx', content: 'export default () => <main />' },
      { path: 'src/pages/Privacy.tsx', content: 'export default () => null' },
      { path: 'src/pages/Terms.tsx', content: 'export default () => null' },
    ])
    expect(files.map((f) => f.path)).toEqual(['src/App.tsx'])
  })

  it('excludes design/ and export/ from studio preview', () => {
    const files = filesForStudioPreview([
      { path: 'preview/index.html', content: '<!DOCTYPE html><html><body>ok</body></html>' },
      { path: 'export/wordpress/style.css', content: 'body{}' },
      { path: 'design/site/index.html', content: '<html></html>' },
      { path: 'design/mockups/home.png', content: 'data:image/png;base64,abc' },
      { path: 'src/main.tsx', content: 'import App from "./App"' },
    ])
    expect(files.map((f) => f.path)).toEqual(['preview/index.html'])
  })
})

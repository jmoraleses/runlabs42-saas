import { describe, expect, it } from 'vitest'
import { mergeWorkspaceBuffers } from '@/lib/projects/mergeWorkspaceBuffers'

describe('mergeWorkspaceBuffers', () => {
  it('conserva archivos locales que no existen en el servidor', () => {
    const local = {
      'src/App.tsx': {
        content: 'export default function App() { return null }',
        dirty: true,
        language: 'typescript',
      },
      'src/components/ContactForm.tsx': {
        content: 'export function ContactForm() { return null }',
        dirty: true,
        language: 'typescript',
      },
    }
    const server = [
      { path: 'src/main.tsx', content: 'import App from "./App"', language: 'typescript' },
      { path: 'index.html', content: '<html></html>', language: 'html' },
    ]
    const merged = mergeWorkspaceBuffers(local, server)
    expect(merged['src/App.tsx']?.content).toContain('export default')
    expect(merged['src/components/ContactForm.tsx']?.content).toContain('ContactForm')
    expect(merged['src/main.tsx']?.content).toContain('import App')
    expect(merged['src/main.tsx']?.dirty).toBe(false)
  })

  it('no pisa buffers dirty con contenido del servidor', () => {
    const local = {
      'src/App.tsx': {
        content: 'local version',
        dirty: true,
        language: 'typescript',
      },
    }
    const server = [{ path: 'src/App.tsx', content: 'server version', language: 'typescript' }]
    const merged = mergeWorkspaceBuffers(local, server)
    expect(merged['src/App.tsx']?.content).toBe('local version')
  })
})

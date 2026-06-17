import { describe, expect, it } from 'vitest'
import { inferPathFromLang } from '@/lib/ai/inferPathFromLang'
import { parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'

describe('inferPathFromLang', () => {
  it('asigna css y json a rutas distintas sin path en el fence', () => {
    const text = [
      '```tsx',
      'export default () => <div />',
      '```',
      '```css',
      'body { margin: 0 }',
      '```',
      '```json',
      '{"name":"app"}',
      '```',
    ].join('\n')
    const ops = parseFileOperationsFromStream(text, { defaultPath: 'src/App.tsx' })
    expect(ops.map((o) => o.path).sort()).toEqual([
      'package.json',
      'src/App.tsx',
      'src/styles/app.css',
    ])
  })

  it('asigna tsx sin path al defaultPath aunque el activo sea vite.config.ts', () => {
    const text = ['```tsx', 'export default () => <form><input /></form>', '```'].join('\n')
    const ops = parseFileOperationsFromStream(text, {
      defaultPath: 'src/App.tsx',
      existingPaths: ['vite.config.ts', 'src/App.tsx'],
    })
    expect(ops).toHaveLength(1)
    expect(ops[0]?.path).toBe('src/App.tsx')
  })

  it('reutiliza css existente en el workspace', () => {
    expect(
      inferPathFromLang('css', {
        defaultPath: 'src/App.tsx',
        knownPaths: ['src/styles/app.css'],
      }),
    ).toBe('src/styles/app.css')
  })

  it('asigna componentes con nombre distinto de App a src/pages/', () => {
    const text = [
      '```tsx',
      'export default function AboutPage() { return <main>About</main> }',
      '```',
    ].join('\n')
    const ops = parseFileOperationsFromStream(text, { defaultPath: 'src/App.tsx' })
    expect(ops).toHaveLength(1)
    expect(ops[0]?.path).toBe('src/pages/AboutPage.tsx')
    expect(ops[0]?.type).toBe('create')
  })

  it('devuelve App y página nueva cuando hay dos bloques tsx sin path', () => {
    const text = [
      '```tsx',
      'export default function App() { return <Routes /> }',
      '```',
      '```tsx',
      'export default function ContactPage() { return <main>Contact</main> }',
      '```',
    ].join('\n')
    const ops = parseFileOperationsFromStream(text, {
      defaultPath: 'src/App.tsx',
      existingPaths: ['src/App.tsx'],
    })
    expect(ops.map((o) => o.path).sort()).toEqual([
      'src/App.tsx',
      'src/pages/ContactPage.tsx',
    ])
  })
})

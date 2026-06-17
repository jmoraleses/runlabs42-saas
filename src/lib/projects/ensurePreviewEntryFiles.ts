import type { FileOperation } from '@/lib/ai/fileOperations'
import { reactScaffold } from '@/lib/scaffolds/react'

const APP_PATHS = ['src/App.tsx', 'src/App.jsx', 'App.tsx', 'App.jsx'] as const

/** App mínima (referencia para preview/reconcile; no se crea al iniciar proyecto). */
export const BLANK_PAGE_APP_TSX = `export default function App() {
  return (
    <main data-sk-id="sk-page" style={{ minHeight: '100dvh', margin: 0, padding: 0 }} />
  )
}
`

/** @deprecated Usar BLANK_PAGE_APP_TSX */
export const MINIMAL_PREVIEW_APP_TSX = BLANK_PAGE_APP_TSX

function hasAppComponent(paths: Set<string>): boolean {
  return APP_PATHS.some((p) => paths.has(p))
}

function hasMainEntry(paths: Set<string>): boolean {
  return (
    paths.has('src/main.tsx') ||
    paths.has('src/main.jsx') ||
    paths.has('src/main.ts') ||
    paths.has('src/main.js') ||
    paths.has('src/index.tsx') ||
    paths.has('src/index.jsx')
  )
}

/** Solo si se solicita explícitamente (`addPreviewEntries: true` en el stream). */
export function previewEntryFileOps(existingPaths: string[]): FileOperation[] {
  const paths = new Set(existingPaths)
  const ops: FileOperation[] = []

  if (!hasMainEntry(paths)) {
    const main = reactScaffold('App').find((f) => f.path === 'src/main.tsx')
    if (main) {
      ops.push({
        type: 'create',
        path: main.path,
        content: main.content,
        language: main.language,
      })
      paths.add(main.path)
    }
  }

  if (!paths.has('index.html')) {
    const html = reactScaffold('App').find((f) => f.path === 'index.html')
    if (html) {
      ops.push({
        type: 'create',
        path: html.path,
        content: html.content,
        language: html.language,
      })
      paths.add(html.path)
    }
  }

  if (!hasAppComponent(paths)) {
    ops.push({
      type: 'create',
      path: 'src/App.tsx',
      content: BLANK_PAGE_APP_TSX,
      language: 'typescript',
    })
  }

  return ops
}

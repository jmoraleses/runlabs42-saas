import type { FileOperation } from '@/lib/ai/fileOperations'
import { BLANK_PAGE_APP_TSX } from '@/lib/projects/ensurePreviewEntryFiles'

const UI_MODULE_RE = /^src\/(components|pages)\/([^/]+)\.(tsx|jsx)$/
const DEFAULT_EXPORT_FN = /export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/
const DEFAULT_EXPORT_CONST = /export\s+default\s+([A-Z][a-zA-Z0-9]*)/

export function isBlankStudioApp(content: string): boolean {
  const t = content.trim()
  if (!t) return true
  if (t.includes('data-sk-id="sk-page"')) return true
  return t.replace(/\s+/g, ' ') === BLANK_PAGE_APP_TSX.trim().replace(/\s+/g, ' ')
}

/** Corrige imports `./components/X` en archivos que ya están en `src/components/`. */
export function fixMisplacedComponentImports(content: string, filePath: string): string {
  const norm = filePath.replace(/\\/g, '/')
  if (!/\/components\/[^/]+\.(tsx|jsx)$/i.test(norm)) return content
  return content
    .replace(/(from\s+['"])\.\/components\/([^'"]+)(['"])/g, '$1./$2$3')
    .replace(/(import\s+['"])\.\/components\/([^'"]+)(['"])/g, '$1./$2$3')
}

function inferDefaultExportName(content: string, fallback: string): string {
  const fn = content.match(DEFAULT_EXPORT_FN)
  if (fn?.[1]) return fn[1]
  const cnst = content.match(DEFAULT_EXPORT_CONST)
  if (cnst?.[1] && cnst[1] !== 'function') return cnst[1]
  return fallback.replace(/\.(tsx|jsx)$/i, '')
}

export function pickPrimaryUiModule(
  files: { path: string; content: string }[],
): { path: string; name: string; importPath: string } | null {
  const candidates: { path: string; name: string; score: number }[] = []
  for (const f of files) {
    const m = f.path.match(UI_MODULE_RE)
    if (!m || !/export\s+default/.test(f.content)) continue
    const base = m[2] ?? ''
    const name = inferDefaultExportName(f.content, base)
    let score = 0
    if (/dashboard/i.test(base)) score += 30
    if (/home|landing|main/i.test(base)) score += 25
    if (/page/i.test(base)) score += 10
    if (f.content.length > 800) score += 5
    candidates.push({ path: f.path, name, score })
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]!
  const importPath = `./${best.path.replace(/^src\//, '')}`.replace(/\.(tsx|jsx)$/i, '')
  return { path: best.path, name: best.name, importPath }
}

export function buildWiredAppTsx(module: { name: string; importPath: string }): string {
  return `import ${module.name} from '${module.importPath}'

export default function App() {
  return <${module.name} />
}
`
}

export type ReconcilePreviewResult = {
  ops: FileOperation[]
  wiredApp: boolean
  fixedImportPaths: string[]
}

/** Repara imports rotos y conecta App.tsx al módulo principal si quedó en blanco. */
export function reconcilePreviewWorkspace(
  files: { path: string; content: string }[],
): ReconcilePreviewResult {
  const ops: FileOperation[] = []
  const fixedImportPaths: string[] = []
  const byPath = new Map(files.map((f) => [f.path, f.content]))

  for (const f of files) {
    const fixed = fixMisplacedComponentImports(f.content, f.path)
    if (fixed !== f.content) {
      fixedImportPaths.push(f.path)
      byPath.set(f.path, fixed)
      ops.push({ type: 'update', path: f.path, content: fixed })
    }
  }

  const appPath = 'src/App.tsx'
  const appContent = byPath.get(appPath) ?? ''
  let wiredApp = false

  if (isBlankStudioApp(appContent)) {
    const refreshed = [...byPath.entries()].map(([path, content]) => ({ path, content }))
    const primary = pickPrimaryUiModule(refreshed)
    if (primary) {
      const nextApp = buildWiredAppTsx(primary)
      byPath.set(appPath, nextApp)
      ops.push({ type: 'update', path: appPath, content: nextApp })
      wiredApp = true
    }
  }

  return { ops, wiredApp, fixedImportPaths }
}

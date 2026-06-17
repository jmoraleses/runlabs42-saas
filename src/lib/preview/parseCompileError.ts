import { resolveLocalImportSpec } from '@/lib/ai/resolveLocalImport'
import { resolveWorkspacePath } from '@/lib/projects/workspacePath'

export type ParsedCompileError = {
  primaryPath: string | null
  line: number | null
  column: number | null
  /** Rutas del workspace a enviar a la IA (1–3 archivos). */
  targetPaths: string[]
}

const SOURCE_EXT = /\.(tsx|ts|jsx|js|css|json|html|mjs)$/i

/** `src/App.tsx:12:8` o `src/App.tsx:12:8: ERROR` */
const LINE_COL_RE =
  /([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:tsx|ts|jsx|js|css|json|html|mjs)):(\d+):(\d+)/g

/** `from "src/App.tsx"` / `desde src/App.tsx` / `in file src/App.tsx` */
const FROM_RE =
  /(?:\bfrom|\bdesde|\bin\s+file|\ben)\s+[`"']?([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:tsx|ts|jsx|js|css))[`"']?/gi

/** `Could not resolve "./App"` / `No se puede resolver './App.css'` */
const RESOLVE_SPEC_RE =
  /(?:resolve|resolver)\s+[`"']?(\.?\.?\/[^`"'\s]+|@\/[^`"'\s]+)[`"']?/gi

function isSourcePath(segment: string): boolean {
  return SOURCE_EXT.test(segment) && !segment.includes('..')
}

function normalizePath(raw: string, knownPaths: string[]): string | null {
  const trimmed = raw.trim().replace(/^\.?\//, '')
  if (!isSourcePath(trimmed)) return null
  return resolveWorkspacePath(trimmed, { existingPaths: knownPaths })
}

function collectPaths(errorText: string, knownPaths: string[]): string[] {
  const found: string[] = []
  const seen = new Set<string>()

  const add = (raw: string) => {
    const p = normalizePath(raw, knownPaths)
    if (!p || seen.has(p)) return
    seen.add(p)
    found.push(p)
  }

  let m: RegExpExecArray | null
  LINE_COL_RE.lastIndex = 0
  while ((m = LINE_COL_RE.exec(errorText)) !== null) {
    add(m[1]!)
  }

  FROM_RE.lastIndex = 0
  while ((m = FROM_RE.exec(errorText)) !== null) {
    add(m[1]!)
  }

  return found
}

function collectUnresolvedModules(
  errorText: string,
  importerPath: string | null,
  knownPaths: string[],
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  RESOLVE_SPEC_RE.lastIndex = 0
  while ((m = RESOLVE_SPEC_RE.exec(errorText)) !== null) {
    const resolved = resolveLocalImportSpec(m[1]!, importerPath, knownPaths)
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved)
      out.push(resolved)
    }
  }
  return out
}

export function parseCompileError(
  errorText: string,
  knownPaths: string[],
): ParsedCompileError {
  const paths = collectPaths(errorText, knownPaths)
  let line: number | null = null
  let column: number | null = null
  let primaryPath: string | null = paths[0] ?? null

  LINE_COL_RE.lastIndex = 0
  const first = LINE_COL_RE.exec(errorText)
  if (first) {
    const p = normalizePath(first[1]!, knownPaths)
    if (p) primaryPath = p
    line = Number.parseInt(first[2]!, 10)
    column = Number.parseInt(first[3]!, 10)
    if (!Number.isFinite(line)) line = null
    if (!Number.isFinite(column)) column = null
  }

  const importerPath =
    paths.find((p) => p.includes('main.')) ?? paths[0] ?? primaryPath ?? null
  const unresolved = collectUnresolvedModules(errorText, importerPath, knownPaths)

  const targetPaths: string[] = []
  const addTarget = (p: string | null) => {
    if (!p || targetPaths.includes(p)) return
    targetPaths.push(p)
  }

  for (const p of unresolved) addTarget(p)
  if (primaryPath) addTarget(primaryPath)
  for (const p of paths) {
    addTarget(p)
    if (targetPaths.length >= 4) break
  }

  if (!targetPaths.length) addTarget('src/App.tsx')

  return { primaryPath, line, column, targetPaths }
}

export function isMissingEntryError(errorText: string): boolean {
  if (/punto de entrada|entry point|src\/main\.tsx/i.test(errorText)) return true
  return /No se pudo resolver\s+["'`]\.\/App["'`]|Could not resolve\s+["'`]\.\/App["'`]/i.test(
    errorText,
  )
}

/** Fragmento alrededor de la línea del error para el prompt. */
export function snippetAroundLine(content: string, line: number | null, radius = 10): string {
  if (!content) return ''
  if (!line || line < 1) {
    const lines = content.split('\n')
    if (lines.length <= radius * 2) return content
    return [...lines.slice(0, radius * 2), '// …'].join('\n')
  }
  const lines = content.split('\n')
  const start = Math.max(0, line - 1 - radius)
  const end = Math.min(lines.length, line + radius)
  const slice = lines.slice(start, end)
  const numbered = slice.map((text, i) => {
    const n = start + i + 1
    const mark = n === line ? '>' : ' '
    return `${mark} ${String(n).padStart(4)} | ${text}`
  })
  if (start > 0) numbered.unshift('    …')
  if (end < lines.length) numbered.push('    …')
  return numbered.join('\n')
}

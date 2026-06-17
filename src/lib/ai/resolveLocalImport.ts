import { resolveWorkspacePath } from '@/lib/projects/workspacePath'

const SOURCE_EXT = /\.(tsx|ts|jsx|js|css|json|html|mjs)$/i

function posixDirname(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return i <= 0 ? '' : norm.slice(0, i)
}

function posixJoin(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/')
}

function posixNormalize(filePath: string): string {
  const stack: string[] = []
  for (const part of filePath.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

function isSourcePath(segment: string): boolean {
  return SOURCE_EXT.test(segment) && !segment.includes('..')
}

/** Resuelve un spec de import relativo o `@/` a ruta de workspace. */
export function resolveLocalImportSpec(
  spec: string,
  importerPath: string | null,
  knownPaths: string[],
): string | null {
  const trimmed = spec.trim().replace(/^['"]|['"]$/g, '')
  if (!trimmed) return null
  if (!trimmed.startsWith('./') && !trimmed.startsWith('../') && !trimmed.startsWith('@/')) {
    return null
  }

  let candidate: string
  if (trimmed.startsWith('@/')) {
    candidate = `src/${trimmed.slice(2)}`
  } else if (trimmed.startsWith('./') || trimmed.startsWith('../')) {
    if (!importerPath) return null
    const dir = posixDirname(importerPath)
    candidate = posixNormalize(posixJoin(dir, trimmed))
  } else {
    return null
  }

  const candidates = SOURCE_EXT.test(candidate)
    ? [candidate]
    : [
        `${candidate}.tsx`,
        `${candidate}.ts`,
        `${candidate}.jsx`,
        `${candidate}.js`,
        `${candidate}/index.tsx`,
        `${candidate}/index.ts`,
        `${candidate}/index.jsx`,
        `${candidate}/index.js`,
      ]

  for (const tryPath of candidates) {
    const resolved = resolveWorkspacePath(tryPath, { existingPaths: knownPaths })
    if (isSourcePath(resolved)) return resolved
  }
  return null
}

const IMPORT_SPEC_RE =
  /\b(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g

const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

const SOURCE_FILE_RE = /\.(tsx|ts|jsx|js)$/i

function collectSpecsFromSource(content: string): string[] {
  const specs: string[] = []
  const seen = new Set<string>()
  const add = (raw: string) => {
    const s = raw.trim()
    if (!s || seen.has(s)) return
    seen.add(s)
    specs.push(s)
  }

  let m: RegExpExecArray | null
  IMPORT_SPEC_RE.lastIndex = 0
  while ((m = IMPORT_SPEC_RE.exec(content)) !== null) {
    add(m[1]!)
  }
  DYNAMIC_IMPORT_RE.lastIndex = 0
  while ((m = DYNAMIC_IMPORT_RE.exec(content)) !== null) {
    add(m[1]!)
  }
  return specs
}

function workspaceHasFile(path: string, knownSet: Set<string>): boolean {
  if (knownSet.has(path)) return true
  const base = path.replace(/\.(tsx|ts|jsx|js)$/i, '')
  return (
    knownSet.has(`${base}.tsx`) ||
    knownSet.has(`${base}.ts`) ||
    knownSet.has(`${base}.jsx`) ||
    knownSet.has(`${base}.js`) ||
    knownSet.has(`${base}/index.tsx`) ||
    knownSet.has(`${base}/index.ts`) ||
    knownSet.has(`${base}/index.jsx`) ||
    knownSet.has(`${base}/index.js`)
  )
}

export type MissingLocalImport = {
  path: string
  spec: string
  importedFrom: string[]
}

/** Detecta imports locales que no tienen archivo en el workspace. */
export function detectMissingLocalImports(
  files: { path: string; content: string }[],
  options?: { maxResults?: number },
): MissingLocalImport[] {
  const knownPaths = files.map((f) => f.path)
  const knownSet = new Set(knownPaths)
  const byPath = new Map<string, MissingLocalImport>()

  for (const file of files) {
    if (!SOURCE_FILE_RE.test(file.path) || !file.content.trim()) continue
    for (const spec of collectSpecsFromSource(file.content)) {
      const resolved = resolveLocalImportSpec(spec, file.path, knownPaths)
      if (!resolved || workspaceHasFile(resolved, knownSet)) continue

      const existing = byPath.get(resolved)
      if (existing) {
        if (!existing.importedFrom.includes(file.path)) {
          existing.importedFrom.push(file.path)
        }
        continue
      }
      byPath.set(resolved, { path: resolved, spec, importedFrom: [file.path] })
    }
  }

  const max = options?.maxResults ?? 16
  const sorted = [...byPath.values()].sort((a, b) => {
    const aApp = a.importedFrom.some((p) => p.includes('App.')) ? 0 : 1
    const bApp = b.importedFrom.some((p) => p.includes('App.')) ? 0 : 1
    if (aApp !== bApp) return aApp - bApp
    return a.path.localeCompare(b.path)
  })
  return sorted.slice(0, max)
}

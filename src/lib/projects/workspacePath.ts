const SRC_LAYOUT_DIRS = [
  'pages',
  'components',
  'context',
  'hooks',
  'lib',
  'utils',
  'styles',
  'services',
  'layouts',
  'routes',
  'store',
  'api',
  'types',
] as const

function projectUsesSrcLayout(existingPaths: string[]): boolean {
  return (
    existingPaths.some((p) => p.startsWith('src/')) || existingPaths.includes('src/App.tsx')
  )
}

/**
 * Si el proyecto usa `src/App.tsx` pero la IA emite `pages/Home.tsx` o `context/Auth.tsx`,
 * antepone `src/` para que los imports relativos desde `src/App.tsx` resuelvan.
 */
export function normalizeGeneratedPath(
  path: string,
  existingPaths: string[] = [],
): string {
  if (path.startsWith('src/') || !projectUsesSrcLayout(existingPaths)) return path
  const top = path.split('/')[0] ?? ''
  if ((SRC_LAYOUT_DIRS as readonly string[]).includes(top)) {
    return `src/${path}`
  }
  return path
}

/** Normaliza rutas de archivos del workspace; evita `''` y rutas inválidas. */
export function normalizeWorkspacePath(
  path: string | null | undefined,
  fallback = 'src/App.tsx',
): string {
  const trimmed = String(path ?? '')
    .trim()
    .replace(/^\/+/, '')
  if (!trimmed || trimmed.includes('..')) return fallback
  const base = trimmed.split('/').pop() ?? ''
  if (!base || base === '.' || base === '..') return fallback
  return trimmed
}

/**
 * Resuelve la ruta efectiva de un archivo generado por la IA.
 * Si el modelo emite `App.tsx` pero el proyecto ya usa `src/App.tsx`, unifica.
 */
export function resolveWorkspacePath(
  path: string | null | undefined,
  options?: { fallback?: string; existingPaths?: string[] },
): string {
  const fallback = options?.fallback ?? 'src/App.tsx'
  const existing = options?.existingPaths ?? []
  let normalized = normalizeWorkspacePath(path, fallback)
  normalized = normalizeGeneratedPath(normalized, existing)

  if (
    normalized === 'App.tsx' &&
    (existing.includes('src/App.tsx') || existing.some((p) => p.endsWith('/src/App.tsx')))
  ) {
    return 'src/App.tsx'
  }

  return normalized
}

export function isValidWorkspacePath(path: string | null | undefined): boolean {
  const trimmed = String(path ?? '').trim().replace(/^\/+/, '')
  if (!trimmed || trimmed.includes('..')) return false
  const base = trimmed.split('/').pop() ?? ''
  return Boolean(base && base !== '.' && base !== '..')
}

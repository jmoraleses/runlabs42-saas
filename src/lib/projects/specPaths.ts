/** Rutas de artefactos de planificación (Spec-Driven Development). */

export const SPEC_DIR = 'spec'

export const SPEC_KIT_PATHS = {
  constitution: `${SPEC_DIR}/constitution.md`,
  spec: `${SPEC_DIR}/spec.md`,
  plan: `${SPEC_DIR}/plan.md`,
  tasks: `${SPEC_DIR}/tasks.md`,
} as const

const LEGACY_SPEC_DIR = 'specs'

export function isSpecWorkspacePath(path: string | null | undefined): boolean {
  const normalized = String(path ?? '')
    .trim()
    .replace(/^\/+/, '')
  return normalized === SPEC_DIR || normalized.startsWith(`${SPEC_DIR}/`)
}

export function isLegacySpecPath(path: string | null | undefined): boolean {
  const normalized = String(path ?? '')
    .trim()
    .replace(/^\/+/, '')
  return normalized === LEGACY_SPEC_DIR || normalized.startsWith(`${LEGACY_SPEC_DIR}/`)
}

/** Migra rutas `specs/…` al directorio `spec/`. */
export function migrateLegacySpecPath(path: string): string {
  const normalized = path.trim().replace(/^\/+/, '')
  if (normalized === LEGACY_SPEC_DIR) return SPEC_DIR
  if (normalized.startsWith(`${LEGACY_SPEC_DIR}/`)) {
    return `${SPEC_DIR}/${normalized.slice(LEGACY_SPEC_DIR.length + 1)}`
  }
  return normalized
}

export function migrateSpecFiles<T extends { path: string; content: string }>(
  files: T[],
): T[] {
  const byPath = new Map<string, T>()
  for (const file of files) {
    const path = migrateLegacySpecPath(file.path)
    const next = path === file.path ? file : { ...file, path }
    const existing = byPath.get(path)
    if (!existing) {
      byPath.set(path, next)
      continue
    }
    if (isLegacySpecPath(file.path) && !isLegacySpecPath(existing.path)) continue
    byPath.set(path, next)
  }
  return [...byPath.values()]
}

export function specContentFromFiles(
  files: { path: string; content: string }[],
): string {
  return files.find((f) => f.path === SPEC_KIT_PATHS.spec)?.content ?? ''
}

export function hasSpecWorkspaceContent(
  files: { path: string; content: string }[],
): boolean {
  return files.some((f) => isSpecWorkspacePath(f.path) && f.content.trim().length > 0)
}

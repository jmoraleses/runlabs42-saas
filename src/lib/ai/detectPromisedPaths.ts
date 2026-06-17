import { resolveWorkspacePath } from '@/lib/projects/workspacePath'

const EXT = '(?:tsx?|jsx?|css|html|json|md)'
const WORKSPACE_PATH_RE =
  /\b(?:src\/[\w./-]+\.(?:tsx?|jsx?|css|html|json|md)|index\.html|public\/[\w./-]+\.\w+)\b/gi
const NUMBERED_PATH_RE = new RegExp(
  `^\\s*\\d+\\.\\s+(?:[\`"']?)([\\w./-]+\\.${EXT})(?:[\`"']?)?`,
  'gim',
)

function normalizeMentionedPath(raw: string): string | null {
  const trimmed = raw.trim().replace(/^[`'"]|[`'"]$/g, '')
  if (!trimmed || trimmed.length > 120) return null
  if (!/\.(tsx?|jsx?|css|html|json|md)$/i.test(trimmed)) return null
  if (/^(uuid|npm|yarn|pnpm)$/i.test(trimmed.split('/').pop() ?? '')) return null
  return resolveWorkspacePath(trimmed, { fallback: trimmed })
}

/** Rutas de archivo citadas en el texto narrativo del asistente (listas numeradas, rutas inline). */
export function extractMentionedFilePaths(text: string): string[] {
  if (!text?.trim()) return []
  const found = new Set<string>()

  const add = (raw: string) => {
    const path = normalizeMentionedPath(raw)
    if (path) found.add(path)
  }

  for (const m of text.matchAll(NUMBERED_PATH_RE)) {
    if (m[1]) add(m[1])
  }
  for (const m of text.matchAll(WORKSPACE_PATH_RE)) {
    add(m[0])
  }

  return [...found].sort((a, b) => a.localeCompare(b))
}

/** Archivos mencionados en el texto que no llegaron en bloques ``` aplicados. */
export function detectUndeliveredFilePaths(
  assistantText: string,
  deliveredPaths: string[],
): string[] {
  const delivered = new Set(
    deliveredPaths.map((p) => resolveWorkspacePath(p, { fallback: p })),
  )
  return extractMentionedFilePaths(assistantText).filter((p) => !delivered.has(p))
}

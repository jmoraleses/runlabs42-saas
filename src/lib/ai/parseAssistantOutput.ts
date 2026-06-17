import type { FileOperation, ParsedSegment } from '@/lib/ai/fileOperations'
import { inferPathFromCodeBlock } from '@/lib/ai/inferPathFromLang'
import { resolveWorkspacePath } from '@/lib/projects/workspacePath'

const FENCE_OPEN = /^([^\n`]*)\n?/
/** Ruta relativa: `src/App.tsx`, `public/manifest.json`, o archivos raíz como `index.html`. */
const PATH_IN_INFO = /^(?:[\w.-]+(?:\/[\w.-]+)+|[\w.-]+\.[A-Za-z0-9]+)\s*$/

function parseFenceInfo(info: string): { lang: string; path: string | null } {
  const trimmed = info.trim()
  if (!trimmed) return { lang: 'plaintext', path: null }
  const parts = trimmed.split(/\s+/)
  const first = parts[0] ?? ''
  const rest = parts.slice(1).join(' ').trim()
  if (PATH_IN_INFO.test(first) && !rest) {
    return { lang: inferLangFromPath(first), path: first }
  }
  if (rest && PATH_IN_INFO.test(rest)) {
    return { lang: first || inferLangFromPath(rest), path: rest }
  }
  if (PATH_IN_INFO.test(first)) {
    return { lang: inferLangFromPath(first), path: first }
  }
  return { lang: first || 'plaintext', path: null }
}

function inferLangFromPath(filePath: string): string {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) return 'typescript'
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) return 'javascript'
  if (filePath.endsWith('.css')) return 'css'
  if (filePath.endsWith('.json')) return 'json'
  if (filePath.endsWith('.md')) return 'markdown'
  if (filePath.endsWith('.html')) return 'html'
  return 'plaintext'
}

/** Parsea texto acumulado del asistente en segmentos texto/código. */
export function parseAssistantSegments(accumulated: string): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  let i = 0

  while (i < accumulated.length) {
    const fenceStart = accumulated.indexOf('```', i)
    if (fenceStart === -1) {
      const tail = accumulated.slice(i)
      if (tail) segments.push({ kind: 'text', content: tail })
      break
    }

    if (fenceStart > i) {
      segments.push({ kind: 'text', content: accumulated.slice(i, fenceStart) })
    }

    const afterTicks = accumulated.slice(fenceStart + 3)
    const openMatch = afterTicks.match(FENCE_OPEN)
    const info = openMatch?.[1] ?? ''
    const contentStart = fenceStart + 3 + (openMatch?.[0]?.length ?? 0)
    const closeIdx = accumulated.indexOf('```', contentStart)

    const { lang, path } = parseFenceInfo(info)

    if (closeIdx === -1) {
      segments.push({
        kind: 'code',
        lang,
        path,
        content: accumulated.slice(contentStart),
        complete: false,
      })
      break
    }

    segments.push({
      kind: 'code',
      lang,
      path,
      content: accumulated.slice(contentStart, closeIdx),
      complete: true,
    })
    i = closeIdx + 3
  }

  return segments
}

/** Respuesta del asistente aún en curso (vacía o con bloques de código sin cerrar). */
export function assistantResponseInProgress(content: string | undefined): boolean {
  if (!content?.trim()) return true
  return parseAssistantSegments(content).some((s) => s.kind === 'code' && !s.complete)
}

/** Convierte bloques de código completos en operaciones de archivo. */
export function fileOperationsFromSegments(
  segments: ParsedSegment[],
  options?: { defaultPath?: string; existingPaths?: string[] },
): FileOperation[] {
  const defaultPath = options?.defaultPath ?? 'src/App.tsx'
  const knownPaths = [...(options?.existingPaths ?? [])]
  const ops: FileOperation[] = []
  const seen = new Set<string>()

  for (const seg of segments) {
    if (seg.kind !== 'code' || !seg.complete) continue
    const rawPath =
      seg.path ??
      inferPathFromCodeBlock(seg.lang, seg.content, { defaultPath, knownPaths })
    const path = resolveWorkspacePath(rawPath, {
      fallback: defaultPath,
      existingPaths: knownPaths,
    })
    if (seen.has(path)) {
      const idx = ops.findIndex((o) => o.type !== 'delete' && o.path === path)
      const existing = ops[idx]
      if (idx >= 0 && existing && existing.type !== 'delete') {
        ops[idx] = { type: 'update', path, content: seg.content.trimEnd() }
      }
      continue
    }
    seen.add(path)
    if (!knownPaths.includes(path)) knownPaths.push(path)
    const exists = options?.existingPaths?.includes(path)
    ops.push({
      type: exists ? 'update' : 'create',
      path,
      content: seg.content.trimEnd(),
      language: seg.lang,
    })
  }

  return ops
}

export function parseFileOperationsFromStream(
  accumulated: string,
  options?: { defaultPath?: string; existingPaths?: string[] },
): FileOperation[] {
  return fileOperationsFromSegments(parseAssistantSegments(accumulated), options)
}

/**
 * Operaciones de archivos cuyo bloque ``` acaba de cerrarse entre dos
 * snapshots del texto acumulado del stream.
 */
export function fileOpsFromNewlyCompletedSegments(
  prevAcc: string,
  nextAcc: string,
  options?: { defaultPath?: string; existingPaths?: string[] },
): FileOperation[] {
  const prevOps = parseFileOperationsFromStream(prevAcc, options)
  const nextOps = parseFileOperationsFromStream(nextAcc, options)
  const prevByPath = new Map(
    prevOps
      .filter((o): o is Extract<typeof o, { type: 'create' | 'update' }> => o.type !== 'delete')
      .map((o) => [o.path, o.content.trimEnd()] as const),
  )
  return nextOps.filter((op) => {
    if (op.type === 'delete') return false
    const prevContent = prevByPath.get(op.path)
    return prevContent === undefined || prevContent !== op.content.trimEnd()
  })
}

export type StreamingAction = {
  path: string
  lang: string
  status: 'writing' | 'done'
  bytes: number
}

/**
 * Lista de archivos detectados en el stream con su estado, para mostrar un
 * artefacto de acciones tipo Bolt en el chat.
 */
export function streamingActionsFromSegments(
  segments: ParsedSegment[],
  options?: { defaultPath?: string },
): StreamingAction[] {
  const defaultPath = options?.defaultPath ?? 'src/App.tsx'
  const byPath = new Map<string, StreamingAction>()
  for (const seg of segments) {
    if (seg.kind !== 'code') continue
    const path = resolveWorkspacePath(seg.path, { fallback: defaultPath })
    byPath.set(path, {
      path,
      lang: seg.lang,
      status: seg.complete ? 'done' : 'writing',
      bytes: seg.content.length,
    })
  }
  return [...byPath.values()]
}

/** Texto visible en chat (sin cuerpos de código completos). */
export function chatDisplayFromSegments(segments: ParsedSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.kind === 'text') return seg.content
      const label = seg.path ?? seg.lang
      if (!seg.complete) return `\n\`\`\`${label}\n…\n`
      return `\n\`\`\`${label}\n${seg.content.length > 0 ? '(archivo en el editor)\n' : ''}\`\`\`\n`
    })
    .join('')
}

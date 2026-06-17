'use client'

import { useCallback, useMemo, useState } from 'react'
import { isValidWorkspacePath } from '@/lib/projects/workspacePath'

const MENTION_FILE_RE = /\.(tsx|ts|jsx|js|css|html|json)$/i

export type WorkspaceFileOption = { path: string; content: string }

export function filterMentionableFiles(files: WorkspaceFileOption[]): WorkspaceFileOption[] {
  return files
    .filter((f) => isValidWorkspacePath(f.path) && MENTION_FILE_RE.test(f.path))
    .filter((f) => !f.path.startsWith('.spec-kit/'))
    .sort((a, b) => a.path.localeCompare(b.path))
}

export function useChatFileMentions(getFiles: () => WorkspaceFileOption[]) {
  const [contextPaths, setContextPaths] = useState<string[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)

  const options = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase()
    const all = filterMentionableFiles(getFiles()).filter((f) => !contextPaths.includes(f.path))
    if (!q) return all.slice(0, 12)
    return all
      .filter(
        (f) =>
          f.path.toLowerCase().includes(q) ||
          f.path.split('/').pop()?.toLowerCase().includes(q),
      )
      .slice(0, 12)
  }, [getFiles, mentionQuery, contextPaths])

  const syncMentionFromInput = useCallback((value: string, caret: number) => {
    const before = value.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at < 0) {
      setMentionOpen(false)
      setMentionQuery('')
      return
    }
    const afterAt = before.slice(at + 1)
    if (/\s/.test(afterAt)) {
      setMentionOpen(false)
      setMentionQuery('')
      return
    }
    setMentionOpen(true)
    setMentionQuery(afterAt)
    setMentionIndex(0)
  }, [])

  const selectMention = useCallback(
    (path: string, input: string, caret: number, setInput: (v: string) => void) => {
      const before = input.slice(0, caret)
      const at = before.lastIndexOf('@')
      if (at < 0) return
      const nextInput = `${input.slice(0, at)}${input.slice(caret)}`.replace(/\s{2,}/g, ' ').trimStart()
      setInput(nextInput)
      setContextPaths((prev) => (prev.includes(path) ? prev : [...prev, path]))
      setMentionOpen(false)
      setMentionQuery('')
    },
    [],
  )

  const addContextPath = useCallback((path: string) => {
    setContextPaths((prev) => (prev.includes(path) ? prev : [...prev, path]))
    setMentionOpen(false)
    setMentionQuery('')
  }, [])

  const removeContextPath = useCallback((path: string) => {
    setContextPaths((prev) => prev.filter((p) => p !== path))
  }, [])

  const clearContextPaths = useCallback(() => {
    setContextPaths([])
    setMentionOpen(false)
    setMentionQuery('')
    setMentionIndex(0)
  }, [])

  const mergeFilesWithContext = useCallback(
    (base: WorkspaceFileOption[]): WorkspaceFileOption[] => {
      if (!contextPaths.length) return base
      const map = new Map(base.map((f) => [f.path, f]))
      const prioritized: WorkspaceFileOption[] = []
      for (const p of contextPaths) {
        const f = map.get(p)
        if (f) prioritized.push(f)
      }
      const rest = base.filter((f) => !contextPaths.includes(f.path))
      return [...prioritized, ...rest]
    },
    [contextPaths],
  )

  const contextPromptSuffix = useMemo(() => {
    if (!contextPaths.length) return ''
    return `\n\n## Archivos de contexto (@)\nEl usuario marcó estos archivos como contexto prioritario:\n${contextPaths.map((p) => `- \`${p}\``).join('\n')}`
  }, [contextPaths])

  return {
    contextPaths,
    mentionOpen,
    mentionQuery,
    mentionIndex,
    setMentionIndex,
    options,
    syncMentionFromInput,
    selectMention,
    addContextPath,
    removeContextPath,
    clearContextPaths,
    mergeFilesWithContext,
    contextPromptSuffix,
  }
}

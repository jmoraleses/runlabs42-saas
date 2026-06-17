'use client'

import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useApp } from '@/components/app/shell'
import {
  parseAssistantSegments,
  parseFileOperationsFromStream,
} from '@/lib/ai/parseAssistantOutput'
import { detectUndeliveredFilePaths } from '@/lib/ai/detectPromisedPaths'
import { simplifyMarkdownTablesForChat } from '@/lib/chat/simplifyMarkdownTables'
import type { ParsedSegment } from '@/lib/ai/fileOperations'
import type { ChatAppliedFile } from '@/lib/chat/types'
import { DiffView, type DiffFileProposal } from '@/components/editor/DiffView'

type CodeSegment = Extract<ParsedSegment, { kind: 'code' }>

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (React.isValidElement(node))
    return extractText((node.props as { children?: React.ReactNode }).children)
  return ''
}

/** Quita bloques ``` del texto narrativo (el código va solo en la tarjeta de archivos). */
function stripFencedCodeFromText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function basename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function fileMetaLabel(content: string, t: (key: string) => string): string {
  const lines = content.split('\n').length
  const kb = content.length / 1024
  if (kb >= 1) {
    return t('assistant.fileMetaLinesKb')
      .replace('{lines}', String(lines))
      .replace('{kb}', kb.toFixed(1))
  }
  return t('assistant.fileMetaLines').replace('{lines}', String(lines))
}

function langFromPath(filePath: string): string {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) return 'typescript'
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) return 'javascript'
  if (filePath.endsWith('.css')) return 'css'
  if (filePath.endsWith('.html')) return 'html'
  if (filePath.endsWith('.json')) return 'json'
  return 'plaintext'
}

function collectCodeSegments(content: string): CodeSegment[] {
  const ops = parseFileOperationsFromStream(content, { defaultPath: 'src/App.tsx' })
  const fromOps = ops
    .filter(
      (o): o is Extract<typeof o, { type: 'create' | 'update' }> =>
        o.type !== 'delete' && Boolean(o.content.trim()),
    )
    .map((o) => ({
      kind: 'code' as const,
      lang: langFromPath(o.path),
      path: o.path,
      content: o.content,
      complete: true,
    }))
  if (fromOps.length) return fromOps

  return parseAssistantSegments(content).filter((s): s is CodeSegment => s.kind === 'code')
}

function splitNarrativeText(content: string, codeItems: CodeSegment[]) {
  const segments = parseAssistantSegments(content)
  const intro: string[] = []
  const outro: string[] = []
  let seenCode = false

  for (const seg of segments) {
    if (seg.kind === 'code') {
      seenCode = true
      continue
    }
    const cleaned = stripFencedCodeFromText(seg.content)
    if (!cleaned) continue
    if (!seenCode) intro.push(cleaned)
    else outro.push(cleaned)
  }

  if (!intro.length && !outro.length && codeItems.length && !segments.some((s) => s.kind === 'code')) {
    return { intro: '', outro: '' }
  }

  return { intro: intro.join('\n\n'), outro: outro.join('\n\n') }
}

function fileExt(path: string | null, lang: string): string {
  if (path?.includes('.')) return path.split('.').pop()?.toLowerCase() ?? 'file'
  if (lang === 'typescript' || lang === 'tsx') return 'tsx'
  if (lang === 'javascript' || lang === 'jsx') return 'jsx'
  if (lang === 'css') return 'css'
  if (lang === 'html') return 'html'
  return lang || 'file'
}

function FileTypeIcon({ ext }: { ext: string }) {
  const label = ext.slice(0, 4).toUpperCase()
  return (
    <span className={`assistant-file-row__ext assistant-file-row__ext--${ext}`} aria-hidden>
      {label}
    </span>
  )
}

function appliedFileMetaLabel(file: ChatAppliedFile, t: (key: string) => string): string {
  const lines = file.lines ?? 0
  const kb = (file.sizeBytes ?? 0) / 1024
  if (kb >= 1) {
    return t('assistant.fileMetaLinesKb')
      .replace('{lines}', String(lines))
      .replace('{kb}', kb.toFixed(1))
  }
  return t('assistant.fileMetaLines').replace('{lines}', String(lines))
}

function FileActionRow({
  seg,
  applied,
  onOpenFile,
  t,
}: {
  seg: CodeSegment
  applied?: ChatAppliedFile
  onOpenFile?: (path: string) => void
  t: (key: string) => string
}) {
  const filePath = applied?.path ?? seg.path ?? null
  const fileName = filePath ? basename(filePath) : seg.lang || t('assistant.unnamedFile')
  const ext = fileExt(filePath, seg.lang)
  const done = seg.complete || Boolean(applied)

  return (
    <div className={`assistant-file-row${done ? ' is-done' : ' is-writing'}`}>
      <FileTypeIcon ext={ext} />
      <div className="assistant-file-row__body">
        {filePath && onOpenFile ? (
          <button
            type="button"
            className="assistant-file-row__name mono"
            onClick={() => onOpenFile(filePath)}
            title={filePath}
          >
            {fileName}
          </button>
        ) : (
          <span className="assistant-file-row__name mono">{fileName}</span>
        )}
        {filePath ? (
          <span className="assistant-file-row__path mono" title={filePath}>
            {filePath}
          </span>
        ) : null}
        <span className="assistant-file-row__meta">
          {applied ? appliedFileMetaLabel(applied, t) : fileMetaLabel(seg.content, t)}
        </span>
      </div>
      <span
        className={`assistant-file-row__badge${done ? ' is-done' : ''}${applied?.action === 'create' ? ' is-create' : applied?.action === 'update' ? ' is-update' : ''}`}
      >
        {done ? (
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 8.5l3.5 3.5L13 5" />
          </svg>
        ) : (
          <span className="assistant-action-spinner" aria-hidden />
        )}
        <span>
          {done
            ? applied?.action === 'create'
              ? t('assistant.created')
              : applied?.action === 'update'
                ? t('assistant.modified')
                : t('assistant.written')
            : t('assistant.writing')}
        </span>
      </span>
    </div>
  )
}

function AssistantMarkdown({
  text,
  t,
}: {
  text: string
  t: (key: string) => string
}) {
  if (!text.trim()) return null

  const displayText = simplifyMarkdownTablesForChat(text)

  function AssistantPre({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
    const codeText = extractText(children).trimEnd()
    if (codeText.length > 120) {
      return (
        <p className="assistant-code-hint">{t('assistant.codeInEditor')}</p>
      )
    }
    return (
      <pre {...props} className="chat-markdown__pre chat-markdown__pre--inline">
        {children}
      </pre>
    )
  }

  return (
    <div className="chat-markdown chat-markdown--assistant">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: AssistantPre,
          code: ({ children }) => <code>{children}</code>,
          table: ({ children }) => (
            <div className="assistant-table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {displayText}
      </ReactMarkdown>
    </div>
  )
}

function appliedToSegments(applied: ChatAppliedFile[]): CodeSegment[] {
  return applied.map((f) => ({
    kind: 'code' as const,
    lang: f.path.endsWith('.tsx') ? 'typescript' : f.path.endsWith('.jsx') ? 'javascript' : 'plaintext',
    path: f.path,
    content: '',
    complete: true,
  }))
}

function FilesArtifact({
  items,
  appliedFiles,
  onOpenFile,
  t,
}: {
  items: CodeSegment[]
  appliedFiles?: ChatAppliedFile[]
  onOpenFile?: (path: string) => void
  t: (key: string) => string
}) {
  const appliedMap = new Map((appliedFiles ?? []).map((f) => [f.path, f]))
  const displayItems = appliedFiles?.length
    ? appliedToSegments(appliedFiles)
    : items
  if (!displayItems.length) return null

  const done = displayItems.filter((s) => s.complete || appliedMap.has(s.path ?? '')).length
  const total = displayItems.length
  const building = !appliedFiles?.length && done < total
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  const created = (appliedFiles ?? []).filter((f) => f.action === 'create').length
  const modified = (appliedFiles ?? []).filter((f) => f.action === 'update').length

  let title = building ? t('assistant.building') : t('assistant.ready')
  if (!building && appliedFiles?.length) {
    if (created && modified) {
      title = t('assistant.readySummary')
        .replace('{created}', String(created))
        .replace('{modified}', String(modified))
    } else if (created) {
      title = t('assistant.readyCreated').replace('{n}', String(created))
    } else if (modified) {
      title = t('assistant.readyModified').replace('{n}', String(modified))
    } else {
      title = t('assistant.readyCount').replace('{n}', String(total))
    }
  } else if (!building && total === 1 && displayItems[0]?.path) {
    title = t('assistant.readyOne').replace('{file}', basename(displayItems[0].path))
  } else if (!building && total > 1) {
    title = t('assistant.readyCount').replace('{n}', String(total))
  }

  return (
    <div className="assistant-artifact">
      <div className="assistant-artifact-head">
        <div className="assistant-artifact-head-left">
          <span
            className={`assistant-artifact-status-dot${building ? '' : ' is-done'}`}
            aria-hidden
          />
          <span className="assistant-artifact-title">{title}</span>
        </div>
        {total > 1 ? (
          <span className="assistant-artifact-count">
            {done}/{total}
          </span>
        ) : null}
      </div>
      {building ? (
        <div className="assistant-artifact-progress" aria-hidden>
          <div className="assistant-artifact-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="assistant-artifact-actions">
        {displayItems.map((seg, j) => (
          <FileActionRow
            key={`${seg.path ?? seg.lang}-${j}`}
            seg={seg}
            applied={seg.path ? appliedMap.get(seg.path) : appliedFiles?.[j]}
            onOpenFile={onOpenFile}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

type AssistantMessageProps = {
  content: string
  appliedFiles?: ChatAppliedFile[]
  onOpenFile?: (path: string) => void
  isReview?: boolean
  getCurrentFileContent?: (path: string) => string
  onApplyReviewFile?: (path: string, content: string) => void
}

export function AssistantMessage({
  content,
  appliedFiles,
  onOpenFile,
  isReview,
  getCurrentFileContent,
  onApplyReviewFile,
}: AssistantMessageProps) {
  const { t } = useApp() as { t: (key: string) => string }

  const layout = useMemo(() => {
    const codeItems = collectCodeSegments(content)
    const { intro, outro } = splitNarrativeText(content, codeItems)
    const deliveredPaths = (appliedFiles ?? []).map((f) => f.path)
    const undelivered = appliedFiles?.length
      ? detectUndeliveredFilePaths(content, deliveredPaths)
      : []
    return { intro, outro, codeItems, undelivered }
  }, [content, appliedFiles])

  const reviewProposals: DiffFileProposal[] = []
  if (isReview && getCurrentFileContent && onApplyReviewFile) {
    const ops = parseFileOperationsFromStream(content, { defaultPath: 'src/App.tsx' })
    for (const op of ops) {
      if (op.path && op.type !== 'delete' && op.content) {
        reviewProposals.push({
          path: op.path,
          proposed: op.content,
          current: getCurrentFileContent(op.path),
        })
      }
    }
  }

  return (
    <div className="assistant-message">
      {reviewProposals.length > 0 ? (
        <DiffView
          files={reviewProposals}
          onAccept={(path, proposed) => onApplyReviewFile!(path, proposed)}
          onReject={() => {}}
          onAcceptAll={() => {
            for (const f of reviewProposals) {
              if (f.proposed.trim() !== f.current.trim()) {
                onApplyReviewFile!(f.path, f.proposed)
              }
            }
          }}
        />
      ) : null}
      <AssistantMarkdown text={layout.intro} t={t} />
      {layout.undelivered.length > 0 ? (
        <p className="assistant-undelivered-notice" role="status">
          {t('assistant.undeliveredNotice').replace('{n}', String(layout.undelivered.length))}
        </p>
      ) : null}
      {layout.codeItems.length > 0 || appliedFiles?.length ? (
        <FilesArtifact
          items={layout.codeItems}
          appliedFiles={appliedFiles}
          onOpenFile={onOpenFile}
          t={t}
        />
      ) : null}
      <AssistantMarkdown text={layout.outro} t={t} />
    </div>
  )
}

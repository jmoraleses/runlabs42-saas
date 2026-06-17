'use client'

import React, { useMemo } from 'react'
import { useApp } from '@/components/app/shell'

export type DiffFileProposal = {
  path: string
  proposed: string
  current: string
}

type DiffViewProps = {
  files: DiffFileProposal[]
  onAccept: (path: string, content: string) => void
  onReject: (path: string) => void
  onAcceptAll?: () => void
}

function lineDiff(oldText: string, newText: string): { type: 'add' | 'del' | 'same'; line: string }[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const rows: { type: 'add' | 'del' | 'same'; line: string }[] = []
  const max = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < max; i++) {
    const o = oldLines[i]
    const n = newLines[i]
    if (o === n) {
      if (n !== undefined) rows.push({ type: 'same', line: n })
    } else {
      if (o !== undefined) rows.push({ type: 'del', line: o })
      if (n !== undefined) rows.push({ type: 'add', line: n })
    }
  }
  return rows.slice(0, 120)
}

export function DiffView({ files, onAccept, onReject, onAcceptAll }: DiffViewProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const changed = useMemo(
    () => files.filter((f) => f.proposed.trim() !== f.current.trim()),
    [files],
  )

  if (!changed.length) {
    return <p className="diff-view__empty">{t('ed.reviewDiff.noChanges')}</p>
  }

  return (
    <div className="diff-view">
      <div className="diff-view__head">
        <span>{t('ed.reviewDiff.title').replace('{n}', String(changed.length))}</span>
        {onAcceptAll ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={onAcceptAll}>
            {t('ed.reviewDiff.acceptAll')}
          </button>
        ) : null}
      </div>
      {changed.map((file) => (
        <DiffFileBlock
          key={file.path}
          file={file}
          onAccept={() => onAccept(file.path, file.proposed)}
          onReject={() => onReject(file.path)}
        />
      ))}
    </div>
  )
}

function DiffFileBlock({
  file,
  onAccept,
  onReject,
}: {
  file: DiffFileProposal
  onAccept: () => void
  onReject: () => void
}) {
  const { t } = useApp() as { t: (key: string) => string }
  const rows = lineDiff(file.current, file.proposed)

  return (
    <section className="diff-view__file">
      <header className="diff-view__file-head">
        <code>{file.path}</code>
        <span className="diff-view__actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={onAccept}>
            {t('ed.reviewDiff.accept')}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onReject}>
            {t('ed.reviewDiff.reject')}
          </button>
        </span>
      </header>
      <pre className="diff-view__body">
        {rows.map((row, i) => (
          <div key={i} className={`diff-view__line diff-view__line--${row.type}`}>
            {row.type === 'add' ? '+ ' : row.type === 'del' ? '- ' : '  '}
            {row.line}
          </div>
        ))}
      </pre>
    </section>
  )
}

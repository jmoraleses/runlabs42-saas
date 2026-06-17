'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useApp } from '@/components/app/shell'

type SpecEditorProps = {
  content: string
  onChange: (value: string) => void
}

function IconMarkdownSource() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  )
}

function IconMarkdownPreview() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export function SpecEditor({ content, onChange }: SpecEditorProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [view, setView] = useState<'preview' | 'source'>('preview')
  const isPreview = view === 'preview'
  const toggleLabel = isPreview ? t('ed.specViewSource') : t('ed.specViewPreview')

  return (
    <div className="editor-spec">
      <div className="editor-spec-bar">
        <span>{t('ed.spec')}</span>
        <span className="spacer" />
        <button
          type="button"
          className={`editor-spec-view-btn${!isPreview ? ' is-active' : ''}`}
          onClick={() => setView(isPreview ? 'source' : 'preview')}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {isPreview ? <IconMarkdownSource /> : <IconMarkdownPreview />}
        </button>
      </div>

      {isPreview ? (
        <div className="editor-spec-preview chat-markdown no-scrollbar">
          {content.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : (
            <p className="editor-spec-preview-empty">{t('ed.specPlaceholder')}</p>
          )}
        </div>
      ) : (
        <textarea
          className="editor-spec-input mono"
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('ed.specPlaceholder')}
          spellCheck={false}
          aria-label={t('ed.spec')}
        />
      )}
    </div>
  )
}

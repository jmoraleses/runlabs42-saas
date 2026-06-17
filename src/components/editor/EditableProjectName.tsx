'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'

type EditableProjectNameProps = {
  value: string
  onSave: (name: string) => void | Promise<void>
  className?: string
  as?: 'h1' | 'h2'
  maxLength?: number
}

export function EditableProjectName({
  value,
  onSave,
  className = '',
  as: Tag = 'h2',
  maxLength = 120,
}: EditableProjectNameProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  async function commit() {
    const trimmed = draft.trim()
    setEditing(false)
    if (!trimmed || trimmed === value) {
      setDraft(value)
      return
    }
    await onSave(trimmed)
  }

  function cancel() {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={`editor-project-name-input ${className}`.trim()}
        value={draft}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        aria-label={t('ed.projectName')}
      />
    )
  }

  return (
    <Tag
      className={`editor-project-name editor-project-name--editable ${className}`.trim()}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setEditing(true)
        }
      }}
      role="button"
      tabIndex={0}
      title={t('ed.clickToRename')}
    >
      {value}
    </Tag>
  )
}

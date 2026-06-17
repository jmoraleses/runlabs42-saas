'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { apiFetch } from '@/lib/api/client'
import { isDemoActive, isDemoProjectId } from '@/lib/auth/demo'
import {
  isMemoryExtractEnabled,
  setMemoryExtractEnabled,
} from '@/lib/studio/memoryPreferences'

function usesLocalMemoryStore(projectId: string | null): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    (isDemoActive() || isDemoProjectId(projectId))
  )
}

type MemoryRow = {
  id: string
  category: string
  content: string
  created_at?: string
  updated_at?: string
}

type StudioMemoryPanelProps = {
  projectId: string | null
  open: boolean
  onClose: () => void
}

export function StudioMemoryPanel({ projectId, open, onClose }: StudioMemoryPanelProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [userMemories, setUserMemories] = useState<MemoryRow[]>([])
  const [projectMemories, setProjectMemories] = useState<MemoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [extractEnabled, setExtractEnabled] = useState(true)
  const localMemory = usesLocalMemoryStore(projectId)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
      const data = await apiFetch<{
        userMemories: MemoryRow[]
        projectMemories: MemoryRow[]
      }>(`/api/memories${q}`)
      setUserMemories(data.userMemories ?? [])
      setProjectMemories(data.projectMemories ?? [])
    } catch {
      setUserMemories([])
      setProjectMemories([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!open) return
    setExtractEnabled(isMemoryExtractEnabled())
    void load()
  }, [open, load])

  async function saveRow(
    id: string,
    scope: 'user' | 'project',
    content: string,
    category: string,
  ) {
    await apiFetch(`/api/memories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        scope,
        content,
        category,
        ...(scope === 'project' && projectId ? { projectId } : {}),
      }),
    })
    await load()
  }

  async function deleteRow(id: string, scope: 'user' | 'project') {
    const q =
      scope === 'project' && projectId
        ? `?scope=${scope}&projectId=${encodeURIComponent(projectId)}`
        : `?scope=${scope}`
    await apiFetch(`/api/memories/${id}${q}`, { method: 'DELETE' })
    await load()
  }

  function toggleExtract(enabled: boolean) {
    setExtractEnabled(enabled)
    setMemoryExtractEnabled(enabled)
  }

  if (!open) return null

  return (
    <div className="studio-memory-panel" role="dialog" aria-label={t('ed.memory.title')}>
      <div className="studio-memory-panel__head">
        <h3>{t('ed.memory.title')}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t('ed.memory.close')}>
          ×
        </button>
      </div>
      {localMemory ? (
        <p className="studio-memory-panel__hint">{t('ed.memory.localHint')}</p>
      ) : null}
      <label className="studio-memory-panel__opt">
        <input
          type="checkbox"
          checked={extractEnabled}
          onChange={(e) => toggleExtract(e.target.checked)}
        />
        <span>{t('ed.memory.autoExtract')}</span>
      </label>
      {loading ? (
        <p className="studio-memory-panel__empty">{t('ed.loading')}</p>
      ) : (
        <>
          <MemorySection
            title={t('ed.memory.userSection')}
            rows={userMemories}
            scope="user"
            onSave={saveRow}
            onDelete={deleteRow}
            emptyLabel={t('ed.memory.empty')}
          />
          {projectId ? (
            <MemorySection
              title={t('ed.memory.projectSection')}
              rows={projectMemories}
              scope="project"
              onSave={saveRow}
              onDelete={deleteRow}
              emptyLabel={t('ed.memory.empty')}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function MemorySection({
  title,
  rows,
  scope,
  onSave,
  onDelete,
  emptyLabel,
}: {
  title: string
  rows: MemoryRow[]
  scope: 'user' | 'project'
  onSave: (id: string, scope: 'user' | 'project', content: string, category: string) => Promise<void>
  onDelete: (id: string, scope: 'user' | 'project') => Promise<void>
  emptyLabel: string
}) {
  if (!rows.length) {
    return (
      <section className="studio-memory-section">
        <h4>{title}</h4>
        <p className="studio-memory-panel__empty">{emptyLabel}</p>
      </section>
    )
  }

  return (
    <section className="studio-memory-section">
      <h4>{title}</h4>
      <ul className="studio-memory-list">
        {rows.map((row) => (
          <MemoryRowEditor
            key={row.id}
            row={row}
            scope={scope}
            onSave={onSave}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  )
}

function MemoryRowEditor({
  row,
  scope,
  onSave,
  onDelete,
}: {
  row: MemoryRow
  scope: 'user' | 'project'
  onSave: (id: string, scope: 'user' | 'project', content: string, category: string) => Promise<void>
  onDelete: (id: string, scope: 'user' | 'project') => Promise<void>
}) {
  const [content, setContent] = useState(row.content)
  const [category, setCategory] = useState(row.category)
  const [busy, setBusy] = useState(false)

  return (
    <li className="studio-memory-item">
      <input
        className="studio-memory-item__cat"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="category"
      />
      <textarea
        className="studio-memory-item__body"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
      />
      <div className="studio-memory-item__actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void onSave(row.id, scope, content, category).finally(() => setBusy(false))
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void onDelete(row.id, scope).finally(() => setBusy(false))
          }}
        >
          ×
        </button>
      </div>
    </li>
  )
}

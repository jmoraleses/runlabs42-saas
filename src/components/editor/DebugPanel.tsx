'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

export type DebugEntry = {
  id: number
  ts: string
  type: 'info' | 'error' | 'success' | 'action' | 'ai'
  message: string
  /** Línea de cierre de ejecución (resumen con icono). */
  summary?: boolean
}

type DebugPanelProps = {
  entries: DebugEntry[]
  onClear: () => void
}

const TYPE_COLOR: Record<DebugEntry['type'], string> = {
  info: 'var(--text-muted)',
  error: '#f87171',
  success: '#4ade80',
  action: '#60a5fa',
  ai: '#c084fc',
}

const TYPE_LABEL: Record<DebugEntry['type'], string> = {
  info: 'INFO',
  error: 'ERR ',
  success: 'OK  ',
  action: 'ACT ',
  ai: 'AI  ',
}

export function DebugPanel({ entries, onClear }: DebugPanelProps) {
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const summaryEntry = [...entries].reverse().find((e) => e.summary)
  const runtimeErrorCount = entries.filter((e) => e.type === 'error' && !e.summary).length
  const tabState = summaryEntry
    ? summaryEntry.type === 'success'
      ? 'success'
      : 'error'
    : runtimeErrorCount > 0
      ? 'error'
      : null

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, open])

  const toggle = useCallback(() => setOpen((v) => !v), [])

  return (
    <div
      className={`editor-debug-panel${open ? ' editor-debug-panel--open' : ''}`}
      data-open={open ? 'true' : 'false'}
    >
      <div className="editor-debug-panel__bar">
        <button
          type="button"
          className={`editor-debug-panel__tab${open ? ' is-active' : ''}${tabState === 'error' ? ' has-errors' : ''}${tabState === 'success' ? ' has-success' : ''}`}
          onClick={toggle}
        >
          <svg
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M2 4l4 4-4 4M9 12h5" />
          </svg>
          Consola
          {tabState === 'error' && runtimeErrorCount > 0 && !summaryEntry ? (
            <span className="editor-debug-panel__badge">{runtimeErrorCount}</span>
          ) : null}
          {tabState === 'success' && summaryEntry ? (
            <span className="editor-debug-panel__badge editor-debug-panel__badge--ok" aria-hidden>
              ✓
            </span>
          ) : null}
          <span className="editor-debug-panel__chevron" aria-hidden>
            {open ? '▼' : '▲'}
          </span>
        </button>
        {open ? (
          <button type="button" className="editor-debug-panel__clear" onClick={onClear}>
            Limpiar
          </button>
        ) : null}
      </div>

      {open ? (
        <div ref={scrollRef} className="editor-debug-panel__body">
          {entries.length === 0 ? (
            <p className="editor-debug-panel__empty">Sin actividad reciente.</p>
          ) : (
            entries.map((e) => (
              <div
                key={e.id}
                className={`editor-debug-panel__line${e.summary ? ' editor-debug-panel__line--summary' : ''}`}
                style={{ borderLeftColor: `${TYPE_COLOR[e.type]}44` }}
              >
                {e.summary ? (
                  <span
                    className={`editor-debug-panel__summary-icon editor-debug-panel__summary-icon--${e.type}`}
                    aria-hidden
                  >
                    {e.type === 'success' ? (
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.5 8.5l3 3L12.5 5" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="8" cy="8" r="6" />
                        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
                      </svg>
                    )}
                  </span>
                ) : (
                  <span className="editor-debug-panel__ts">{e.ts}</span>
                )}
                {!e.summary ? (
                  <span
                    className="editor-debug-panel__type"
                    style={{ color: TYPE_COLOR[e.type] }}
                  >
                    {TYPE_LABEL[e.type]}
                  </span>
                ) : null}
                <span className="editor-debug-panel__msg">{e.message}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

let _debugId = 0
export function makeDebugEntry(
  type: DebugEntry['type'],
  message: string,
  opts?: { summary?: boolean },
): DebugEntry {
  const now = new Date()
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  return { id: ++_debugId, ts, type, message, summary: opts?.summary }
}

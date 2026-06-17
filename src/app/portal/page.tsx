'use client'

import { useEffect, useMemo, useState } from 'react'
import '@/app/auto/auto.css'
type ZipInputRow = {
  platformId: string
  fileName: string
  absolutePath: string
  sizeBytes: number
  updatedAt: string
}

type ProcessedRun = {
  runId: string
  platformId: string
  inputZip: string
  outputDir: string
  reportPath: string
  ok: boolean
  validation?: { checks?: string[]; errors?: string[] }
  templateMonster?: { ok?: boolean; packagePath?: string | null; errors?: string[] }
  install?: { ok?: boolean; seedMessage?: string; seedDetails?: string[] }
}

export default function PortalOrchestratorPage() {
  const [rows, setRows] = useState<ZipInputRow[]>([])
  const [busyByKey, setBusyByKey] = useState<Record<string, boolean>>({})
  const [busyAll, setBusyAll] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [roots, setRoots] = useState<{ inputsRoot: string; outputsRoot: string } | null>(null)
  const [runs, setRuns] = useState<ProcessedRun[]>([])

  const loadInputs = async () => {
    setError(null)
    const res = await fetch('/api/auto/orchestrator/zip')
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      files?: ZipInputRow[]
      roots?: { inputsRoot?: string; outputsRoot?: string }
      error?: string
    }
    if (!res.ok || data.ok !== true) throw new Error(data.error ?? `HTTP ${res.status}`)
    setRows(Array.isArray(data.files) ? data.files : [])
    setRoots({
      inputsRoot: String(data.roots?.inputsRoot ?? ''),
      outputsRoot: String(data.roots?.outputsRoot ?? ''),
    })
  }

  useEffect(() => {
    void loadInputs().catch((e) => {
      setError(e instanceof Error ? e.message : 'No se pudo cargar stitch-zip')
    })
  }, [])

  const processOne = async (row: ZipInputRow) => {
    const key = `${row.platformId}:${row.fileName}`
    setBusyByKey((prev) => ({ ...prev, [key]: true }))
    setError(null)
    try {
      const res = await fetch('/api/auto/orchestrator/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformId: row.platformId,
          zipFileName: row.fileName,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: ProcessedRun
        error?: string
      }
      if (!res.ok || data.ok !== true || !data.result) throw new Error(data.error ?? `HTTP ${res.status}`)
      setRuns((prev) => [data.result as ProcessedRun, ...prev])
      setMessage(`Procesado: ${row.fileName} (${row.platformId})`)
      await loadInputs()
    } finally {
      setBusyByKey((prev) => ({ ...prev, [key]: false }))
    }
  }

  const processAll = async () => {
    setBusyAll(true)
    setError(null)
    let ok = 0
    for (const row of rows) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await processOne(row)
        ok += 1
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error procesando lote')
      }
    }
    setBusyAll(false)
    setMessage(`Lote finalizado: ${ok}/${rows.length} procesados`)
  }

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, ZipInputRow[]>>((acc, row) => {
      acc[row.platformId] = acc[row.platformId] ?? []
      acc[row.platformId].push(row)
      return acc
    }, {})
  }, [rows])

  return (
    <div className="auto-page">
      <header className="auto-header">
        <div className="auto-header__title">
          <p className="auto-eyebrow">Portal stitch-zip</p>
          <h1>Procesador ZIP por plataforma</h1>
          <p className="auto-sub">
            Entrada: <code>{roots?.inputsRoot || '...'}</code> · Salida: <code>{roots?.outputsRoot || '...'}</code>
          </p>
        </div>
      </header>

      <section className="auto-panel">
        <h2>ZIPs en inputs</h2>
        <div className="auto-panel__actions">
          <button type="button" className="auto-btn auto-btn--ghost" onClick={() => void loadInputs()}>
            Recargar
          </button>
          <button
            type="button"
            className="auto-btn"
            disabled={!rows.length || busyAll}
            onClick={() => void processAll()}
          >
            {busyAll ? 'Procesando lote…' : 'Procesar todos'}
          </button>
        </div>
        {!rows.length ? <p className="auto-muted">No hay ZIPs pendientes en inputs.</p> : null}
        {Object.entries(grouped).map(([platformId, files]) => (
          <div key={platformId} style={{ marginBottom: '1rem' }}>
            <h3>{platformId}</h3>
            <ul className="auto-stack-run-list">
              {files.map((row) => {
                const key = `${row.platformId}:${row.fileName}`
                return (
                  <li key={key} className="auto-stack-run-item">
                    <div className="auto-stack-run-item__head">
                      <strong>{row.fileName}</strong>
                      <span className="auto-chip is-pending">{Math.round(row.sizeBytes / 1024)} KB</span>
                    </div>
                    <p className="auto-muted">Actualizado: {new Date(row.updatedAt).toLocaleString()}</p>
                    <div className="auto-panel__actions">
                      <button
                        type="button"
                        className="auto-btn"
                        disabled={busyByKey[key] === true}
                        onClick={() => void processOne(row)}
                      >
                        {busyByKey[key] === true ? 'Procesando…' : 'Procesar'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      <section className="auto-panel">
        <h2>Últimas ejecuciones</h2>
        {!runs.length ? <p className="auto-muted">Sin ejecuciones aún.</p> : null}
        <ul className="auto-stack-run-list">
          {runs.map((run) => (
            <li key={run.runId} className={`auto-stack-run-item ${run.ok ? 'is-ok' : 'is-error'}`}>
              <div className="auto-stack-run-item__head">
                <strong>{run.platformId}</strong>
                <span className={`auto-chip ${run.ok ? 'is-done' : 'is-pending'}`}>
                  {run.ok ? 'OK' : 'Con incidencias'}
                </span>
              </div>
              <p className="auto-muted">ZIP: {run.inputZip}</p>
              <p className="auto-muted">Output: {run.outputDir}</p>
              <p className="auto-muted">Reporte: {run.reportPath}</p>
              {(run.validation?.checks ?? []).length ? (
                <ul className="auto-zip-list">
                  {(run.validation?.checks ?? []).map((line) => (
                    <li key={`${run.runId}-${line}`} className="auto-muted">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
              {(run.validation?.errors ?? []).length ? (
                <ul className="auto-zip-list">
                  {(run.validation?.errors ?? []).map((line) => (
                    <li key={`${run.runId}-err-${line}`} className="auto-stack-run-item__stderr">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="auto-muted">TemplateMonster: {run.templateMonster?.ok ? 'OK' : 'Con incidencias'}</p>
              <p className="auto-muted">Instalación stack: {run.install?.ok ? 'OK' : 'Con incidencias'}</p>
            </li>
          ))}
        </ul>
      </section>

      {error ? <div className="auto-banner auto-banner--error">{error}</div> : null}
      {message ? <div className="auto-banner auto-banner--ok">{message}</div> : null}
    </div>
  )
}

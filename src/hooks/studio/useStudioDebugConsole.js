import { useCallback, useEffect, useRef, useState } from 'react'
import { makeDebugEntry } from '@/components/editor/DebugPanel'

/**
 * Consola de depuración del Studio: se limpia en cada ejecución y cierra con resumen verde/rojo.
 */
export function useStudioDebugConsole({
  t,
  compileFixBusy,
  aiStreamActive,
  /** Mantiene la consola abierta mientras el autofix sigue corrigiendo el preview. */
  holdFinalize = false,
}) {
  const [entries, setEntries] = useState([])
  const [runActive, setRunActive] = useState(false)
  const runActiveRef = useRef(false)
  const runRef = useRef({
    hadError: false,
    hadSuccess: false,
  })
  const finalizeTimerRef = useRef(null)

  const startRun = useCallback(() => {
    if (finalizeTimerRef.current != null) {
      window.clearTimeout(finalizeTimerRef.current)
      finalizeTimerRef.current = null
    }
    runRef.current = { hadError: false, hadSuccess: false }
    runActiveRef.current = true
    setRunActive(true)
    setEntries([])
  }, [])

  const finishRun = useCallback(() => {
    if (!runActiveRef.current) return
    runActiveRef.current = false
    setRunActive(false)

    const run = runRef.current
    let type = 'success'
    let message = t('ed.debug.runOk')

    if (run.hadError && run.hadSuccess) {
      type = 'success'
      message = t('ed.debug.runRecovered')
    } else if (run.hadError) {
      type = 'error'
      message = t('ed.debug.runFailed')
    }

    setEntries((prev) => [
      ...prev,
      makeDebugEntry(type, message, { summary: true }),
    ])
  }, [t])

  const addDebug = useCallback((type, message) => {
    if (runActiveRef.current) {
      if (type === 'error') runRef.current.hadError = true
      if (type === 'success') runRef.current.hadSuccess = true
    }
    setEntries((prev) => [...prev.slice(-80), makeDebugEntry(type, message)])
  }, [])

  const clear = useCallback(() => {
    if (finalizeTimerRef.current != null) {
      window.clearTimeout(finalizeTimerRef.current)
      finalizeTimerRef.current = null
    }
    runActiveRef.current = false
    setRunActive(false)
    setEntries([])
  }, [])

  useEffect(() => {
    if (!runActive) return
    if (aiStreamActive || compileFixBusy || holdFinalize) return

    if (finalizeTimerRef.current != null) window.clearTimeout(finalizeTimerRef.current)
    finalizeTimerRef.current = window.setTimeout(() => {
      finalizeTimerRef.current = null
      finishRun()
    }, 900)

    return () => {
      if (finalizeTimerRef.current != null) {
        window.clearTimeout(finalizeTimerRef.current)
        finalizeTimerRef.current = null
      }
    }
  }, [aiStreamActive, compileFixBusy, finishRun, runActive, holdFinalize])

  return { entries, addDebug, startRun, finishRun, clear, runActive }
}

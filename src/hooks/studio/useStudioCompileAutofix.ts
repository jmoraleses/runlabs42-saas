'use client'

import { useCallback, useRef, useState } from 'react'
import { buildCompileFixPrompt } from '@/lib/ai/buildCompileFixPrompt'
import { buildVercelBuildFixPrompt } from '@/lib/ai/buildVercelBuildFixPrompt'
import { buildMissingImportsFixPrompt } from '@/lib/ai/buildMissingImportsFixPrompt'
import { buildUndeliveredFilesFixPrompt } from '@/lib/ai/buildUndeliveredFilesFixPrompt'
import type { MissingLocalImport } from '@/lib/ai/resolveLocalImport'
import { consumeAIStream } from '@/lib/ai/stream'
import {
  isMissingEntryError,
  parseCompileError,
} from '@/lib/preview/parseCompileError'
import type { ChatStudioEvent } from '@/lib/chat/studioEvents'
import { apiFetch } from '@/lib/api/client'
import { summarizeCompileError } from '@/lib/chat/studioEvents'
import type { WorkspaceBuffers } from '@/lib/ai/applyFileOperations'
import type { CategoryModelChoices } from '@/lib/ai/chatModelChoices'

export const MAX_COMPILE_FIX_ATTEMPTS = 50
/** Si el stream de autofix no termina, cerrar el estado «Corrigiendo…». */
const COMPILE_FIX_TIMEOUT_MS = 90_000
/** Pausa entre reintentos cuando el preview sigue fallando. */
const COMPILE_FIX_RETRY_DELAY_MS = 1_400

type CompileFixDeps = {
  t: (key: string) => string
  buffersRef: React.RefObject<WorkspaceBuffers>
  effectiveProjectId: string | null
  projectName: string
  modelChoice: string
  categoryModels?: CategoryModelChoices
  framework: string
  targetPlatforms: string[]
  chatSessionId?: string
  geminiEnabled: boolean
  aiStreamActiveRef: React.RefObject<boolean>
  /** Solo true tras enviar un mensaje por chat (no edición manual de código). */
  autofixFromChatRef: React.MutableRefObject<boolean>
  /** Preferencia del usuario: autocorregir errores del preview tras el chat. */
  autofixEnabledRef: React.RefObject<boolean>
  pushSnapshot: () => void
  setIframeKey: React.Dispatch<React.SetStateAction<number>>
  applyStreamOpsFromText: (
    acc: string,
    options?: { onlyPaths?: string[]; projectIdOverride?: string | null },
  ) => Promise<{ error?: string; touched?: string[] } | undefined>
  applyMissingEntryFiles: () => Promise<boolean>
  addDebug: (type: string, message: string) => void
  onStudioChatEvent?: (event: ChatStudioEvent) => void
}

export function useStudioCompileAutofix(deps: CompileFixDeps) {
  const compileFixRef = useRef({
    sig: null as string | null,
    attempts: 0,
    running: false,
    fixing: false,
    gaveUp: false,
    abort: null as AbortController | null,
    lastPrimary: null as string | null,
    compileWaitTimer: null as number | null,
    retryTimer: null as number | null,
    lastErrorText: null as string | null,
  })
  const lastCompileErrorAtRef = useRef({ sig: '', at: 0 })
  const [compileFixBusy, setCompileFixBusy] = useState(false)
  const [previewFixGaveUp, setPreviewFixGaveUp] = useState(false)
  const [compileFixAttempt, setCompileFixAttempt] = useState(0)

  const clearRetryTimer = useCallback(() => {
    const cf = compileFixRef.current
    if (cf.retryTimer != null) {
      window.clearTimeout(cf.retryTimer)
      cf.retryTimer = null
    }
  }, [])

  const clearCompileFixBusy = useCallback(() => {
    const cf = compileFixRef.current
    if (cf.compileWaitTimer != null) {
      window.clearTimeout(cf.compileWaitTimer)
      cf.compileWaitTimer = null
    }
    cf.running = false
    cf.fixing = false
    setCompileFixBusy(false)
  }, [])

  const isAutofixEligible = useCallback(() => {
    const cf = compileFixRef.current
    if (!deps.autofixEnabledRef.current || cf.gaveUp) return false
    return (
      deps.autofixFromChatRef.current ||
      cf.fixing ||
      cf.attempts > 0
    )
  }, [deps])

  const shouldEmitAutofixChatEvent = useCallback(() => {
    const cf = compileFixRef.current
    return (
      deps.autofixFromChatRef.current ||
      cf.attempts > 0 ||
      cf.running ||
      cf.fixing
    )
  }, [deps])

  const emitCompileFailedToChat = useCallback(() => {
    if (!shouldEmitAutofixChatEvent()) return
    deps.onStudioChatEvent?.({ kind: 'compile-failed' })
  }, [deps, shouldEmitAutofixChatEvent])

  const scheduleAutofixRetry = useCallback(
    (errorText: string) => {
      const cf = compileFixRef.current
      if (!deps.autofixEnabledRef.current || cf.gaveUp) return
      if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) return
      if (cf.running || cf.fixing || deps.aiStreamActiveRef.current) return
      cf.lastErrorText = errorText
      clearRetryTimer()
      cf.retryTimer = window.setTimeout(() => {
        cf.retryTimer = null
        if (!isAutofixEligible()) return
        if (cf.running || cf.fixing || deps.aiStreamActiveRef.current) return
        const pending = cf.lastErrorText
        if (pending) handleCompileErrorRef.current(pending)
      }, COMPILE_FIX_RETRY_DELAY_MS)
    },
    [clearRetryTimer, deps, isAutofixEligible],
  )

  const handleCompileErrorRef = useRef<(errorText: string) => void>(() => {})

  const endCompileFixAttempt = useCallback(
    (outcome: 'failed' | 'aborted' | 'silent', errorText?: string) => {
      clearCompileFixBusy()
      if (outcome === 'failed') {
        emitCompileFailedToChat()
        if (errorText?.trim()) scheduleAutofixRetry(errorText)
      }
    },
    [clearCompileFixBusy, emitCompileFailedToChat, scheduleAutofixRetry],
  )

  const cancelCompileFixSilently = useCallback(() => {
    const cf = compileFixRef.current
    clearRetryTimer()
    if (cf.abort) {
      try {
        cf.abort.abort()
      } catch {
        /* ignore */
      }
      cf.abort = null
    }
    clearCompileFixBusy()
  }, [clearCompileFixBusy])

  const scheduleCompileWaitTimeout = useCallback(() => {
    const cf = compileFixRef.current
    if (cf.compileWaitTimer != null) window.clearTimeout(cf.compileWaitTimer)
    cf.compileWaitTimer = window.setTimeout(() => {
      cf.compileWaitTimer = null
      if (!cf.fixing || cf.running) return
      deps.addDebug('error', 'Autofix: el preview no respondió tras aplicar cambios')
      endCompileFixAttempt('failed', cf.lastErrorText ?? undefined)
    }, COMPILE_FIX_TIMEOUT_MS)
  }, [deps, endCompileFixAttempt])

  const giveUpCompileFix = useCallback(() => {
    const cf = compileFixRef.current
    clearRetryTimer()
    if (cf.abort) {
      try {
        cf.abort.abort()
      } catch {
        /* ignore */
      }
      cf.abort = null
    }
    cf.gaveUp = true
    clearCompileFixBusy()
    setPreviewFixGaveUp(true)
    deps.addDebug('error', deps.t('ed.compileFix.failed'))
    emitCompileFailedToChat()
  }, [clearCompileFixBusy, deps, emitCompileFailedToChat])

  const resetCompileFixState = useCallback(() => {
    const cf = compileFixRef.current
    clearRetryTimer()
    if (cf.compileWaitTimer != null) {
      window.clearTimeout(cf.compileWaitTimer)
      cf.compileWaitTimer = null
    }
    cf.sig = null
    cf.attempts = 0
    cf.gaveUp = false
    cf.running = false
    cf.fixing = false
    cf.lastErrorText = null
    setPreviewFixGaveUp(false)
    setCompileFixAttempt(0)
  }, [clearRetryTimer])

  const runTargetedCompileFix = useCallback(
    async (errorText: string, primary: string, targetPaths: string[], parsed: ReturnType<typeof parseCompileError>) => {
      const cf = compileFixRef.current
      cf.running = true
      cf.fixing = true
      const abortController = new AbortController()
      cf.abort = abortController
      setCompileFixBusy(true)
      deps.pushSnapshot()
      cf.lastPrimary = primary
      const fixingMsg = deps.t('chat.studio.compileFixing').replace('{file}', primary.split('/').pop() ?? primary)
      deps.addDebug('info', fixingMsg)
      deps.onStudioChatEvent?.({
        kind: 'compile-fixing',
        file: primary,
        attempt: cf.attempts,
        max: MAX_COMPILE_FIX_ATTEMPTS,
      })

      const timeoutId = window.setTimeout(() => {
        if (!abortController.signal.aborted) {
          try {
            abortController.abort()
          } catch {
            /* ignore */
          }
          deps.addDebug('error', 'Autofix: tiempo de espera agotado')
          if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) {
            giveUpCompileFix()
          } else {
            endCompileFixAttempt('failed', cf.lastErrorText ?? undefined)
          }
        }
      }, COMPILE_FIX_TIMEOUT_MS)

      const primaryContent = deps.buffersRef.current?.[primary]?.content ?? ''
      const prompt = buildCompileFixPrompt({
        error: errorText,
        path: primary,
        line: parsed.line,
        content: primaryContent,
      })

      const filesForFix = targetPaths.map((path) => ({
        path,
        content: deps.buffersRef.current?.[path]?.content ?? '',
      }))

      let acc = ''
      let applyPromise = Promise.resolve()
      let streamEnded = false
      try {
        await consumeAIStream(
          {
            prompt,
            projectId: deps.effectiveProjectId ?? undefined,
            projectName: deps.projectName,
            command: '/build',
            activePath: primary,
            code: primaryContent,
            files: filesForFix,
            model: deps.modelChoice,
            ...(deps.categoryModels ? { categoryModels: deps.categoryModels } : {}),
            framework: deps.framework,
            targetPlatforms: deps.targetPlatforms,
            chatSessionId: deps.chatSessionId,
            useSpecKit: false,
          },
          {
            onToken: (tok) => {
              acc += tok
            },
            onDone: () => {
              streamEnded = true
              applyPromise = (async () => {
                try {
                  let result = await deps.applyStreamOpsFromText(acc, { onlyPaths: targetPaths })
                  if (result?.error) {
                    deps.addDebug('error', result.error)
                    if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) giveUpCompileFix()
                    else endCompileFixAttempt('failed', errorText)
                    return
                  }
                  if (!result?.touched?.length) {
                    result = await deps.applyStreamOpsFromText(acc)
                  }
                  if (!result?.touched?.length) {
                    deps.addDebug('info', 'Autofix sin cambios aplicables')
                    if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) giveUpCompileFix()
                    else endCompileFixAttempt('failed', errorText)
                    return
                  }
                  deps.setIframeKey((k) => k + 1)
                  cf.running = false
                  scheduleCompileWaitTimeout()
                } catch {
                  if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) giveUpCompileFix()
                  else endCompileFixAttempt('failed', errorText)
                }
              })()
            },
            onError: () => {
              deps.addDebug('error', 'Autofix: error en stream')
              if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) giveUpCompileFix()
              else endCompileFixAttempt('failed', errorText)
            },
          },
          { signal: abortController.signal },
        )
        await applyPromise
        if (!streamEnded && !abortController.signal.aborted) {
          deps.addDebug('error', 'Autofix: stream sin finalizar')
          if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) giveUpCompileFix()
          else endCompileFixAttempt('failed', errorText)
        }
      } catch (err) {
        const e = err as { name?: string }
        if (e?.name === 'AbortError' || abortController.signal.aborted) {
          if (!cf.gaveUp) {
            deps.addDebug('info', 'Autofix cancelado')
            endCompileFixAttempt('aborted')
          }
        } else {
          deps.addDebug('error', 'Autofix interrumpido')
          if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) giveUpCompileFix()
          else endCompileFixAttempt('failed', errorText)
        }
      } finally {
        window.clearTimeout(timeoutId)
        if (cf.abort === abortController) cf.abort = null
        if (cf.running) {
          if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) giveUpCompileFix()
          else endCompileFixAttempt('failed', errorText)
        }
      }
    },
    [deps, giveUpCompileFix, endCompileFixAttempt, scheduleCompileWaitTimeout],
  )

  const stopCompileFix = useCallback(() => {
    const cf = compileFixRef.current
    clearRetryTimer()
    const wasActive = cf.running || cf.fixing || cf.attempts > 0
    if (cf.abort) {
      try {
        cf.abort.abort()
      } catch {
        /* ignore */
      }
      cf.abort = null
    }
    cf.gaveUp = true
    clearCompileFixBusy()
    if (wasActive) emitCompileFailedToChat()
  }, [clearCompileFixBusy, emitCompileFailedToChat])

  const handleCompileError = useCallback(
    (errorText: string) => {
      if (!errorText) return
      const cf = compileFixRef.current
      cf.lastErrorText = errorText
      if (!isAutofixEligible()) return
      if (cf.gaveUp || previewFixGaveUp) return
      if (cf.running || deps.aiStreamActiveRef.current) return
      if (cf.fixing) {
        clearCompileFixBusy()
      }
      if (!deps.geminiEnabled) {
        setPreviewFixGaveUp(true)
        deps.addDebug('info', deps.t('ed.compileFix.aiDisabled'))
        return
      }

      const sig = `${errorText.slice(0, 280)}`
      const now = Date.now()
      if (
        sig === lastCompileErrorAtRef.current.sig &&
        now - lastCompileErrorAtRef.current.at < 2000 &&
        (cf.running || cf.fixing)
      ) {
        return
      }
      lastCompileErrorAtRef.current = { sig, at: now }

      if (sig !== cf.sig) {
        cf.sig = sig
        cf.attempts = 0
        cf.gaveUp = false
        setPreviewFixGaveUp(false)
      }
      if (cf.gaveUp) return

      cf.attempts += 1
      setCompileFixAttempt(cf.attempts)
      if (cf.attempts > MAX_COMPILE_FIX_ATTEMPTS) {
        giveUpCompileFix()
        return
      }

      if (cf.attempts === 1) {
        void (async () => {
          const knownPaths = Object.keys(deps.buffersRef.current ?? {})
          const { summary, file } = summarizeCompileError(errorText, knownPaths)
          let refined = summary
          try {
            const res = await apiFetch<{ summary?: string }>('/api/chat/summarize', {
              method: 'POST',
              body: JSON.stringify({ text: summary, maxChars: 200 }),
            })
            if (res.summary?.trim()) refined = res.summary.trim()
          } catch {
            /* heurística local */
          }
          deps.onStudioChatEvent?.({ kind: 'compile-error', summary: refined, file })
        })()
      }

      cf.running = true
      cf.fixing = true
      void (async () => {
        if (isMissingEntryError(errorText)) {
          cf.running = false
          cf.fixing = false
          const ok = await deps.applyMissingEntryFiles()
          if (ok) {
            cf.sig = null
            cf.running = false
            cf.fixing = false
            return
          }
          cf.running = false
          cf.fixing = false
          if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) setPreviewFixGaveUp(true)
          else scheduleAutofixRetry(errorText)
          return
        }

        const knownPaths = Object.keys(deps.buffersRef.current ?? {})
        const parsed = parseCompileError(errorText, knownPaths)
        const targetPaths = parsed.targetPaths.slice(0, 4)
        if (!targetPaths.length) {
          cf.running = false
          cf.fixing = false
          if (cf.attempts >= MAX_COMPILE_FIX_ATTEMPTS) setPreviewFixGaveUp(true)
          else scheduleAutofixRetry(errorText)
          return
        }

        const missingInWorkspace = targetPaths.filter(
          (p) => !deps.buffersRef.current?.[p]?.content?.trim(),
        )
        const primary =
          missingInWorkspace[0] ??
          (parsed.primaryPath && targetPaths.includes(parsed.primaryPath)
            ? parsed.primaryPath
            : targetPaths[0])

        if (primary) await runTargetedCompileFix(errorText, primary, targetPaths, parsed)
      })()
    },
    [clearCompileFixBusy, deps, previewFixGaveUp, giveUpCompileFix, runTargetedCompileFix, isAutofixEligible, scheduleAutofixRetry],
  )

  handleCompileErrorRef.current = handleCompileError

  const handleCompileOk = useCallback(() => {
    const cf = compileFixRef.current
    clearRetryTimer()
    cf.lastErrorText = null
    const wasFixing = cf.fixing && !cf.gaveUp
    const fixedFile = cf.lastPrimary ?? undefined
    setPreviewFixGaveUp(false)
    cf.sig = null
    cf.attempts = 0
    cf.gaveUp = false
    clearCompileFixBusy()
    setCompileFixAttempt(0)
    if (wasFixing) {
      deps.addDebug('success', deps.t('ed.compileFix.fixed'))
      deps.onStudioChatEvent?.({
        kind: 'compile-fixed',
        file: fixedFile,
      })
      cf.lastPrimary = null
    }
  }, [clearCompileFixBusy, clearRetryTimer, deps])

  const runManualCompileFix = useCallback(
    (errorText: string) => {
      const cf = compileFixRef.current
      cf.gaveUp = false
      cf.attempts = 0
      setPreviewFixGaveUp(false)
      handleCompileError(errorText)
    },
    [handleCompileError],
  )

  const runMissingImportsFix = useCallback(
    (missing: MissingLocalImport[]) => {
      if (!missing.length) return
      const cf = compileFixRef.current
      if (!isAutofixEligible()) return
      if (cf.gaveUp || previewFixGaveUp) return
      if (cf.running || deps.aiStreamActiveRef.current) return
      if (cf.fixing) {
        clearCompileFixBusy()
      }
      if (!deps.geminiEnabled || !deps.effectiveProjectId) return

      const knownPaths = Object.keys(deps.buffersRef.current ?? {})
      const files = knownPaths.map((path) => ({
        path,
        content: deps.buffersRef.current?.[path]?.content ?? '',
      }))
      const targetPaths = missing.map((m) => m.path)
      const primary = targetPaths[0] ?? 'src/App.tsx'
      const prompt = buildMissingImportsFixPrompt({ missing, files })

      cf.running = true
      cf.fixing = true
      const abortController = new AbortController()
      cf.abort = abortController
      setCompileFixBusy(true)
      deps.pushSnapshot()
      cf.lastPrimary = primary
      deps.addDebug(
        'info',
        `Generando ${targetPaths.length} archivo(s) faltante(s): ${targetPaths.map((p) => p.split('/').pop()).join(', ')}`,
      )
      deps.onStudioChatEvent?.({
        kind: 'compile-fixing',
        file: primary,
        attempt: 1,
        max: MAX_COMPILE_FIX_ATTEMPTS,
      })

      let acc = ''
      let applyPromise = Promise.resolve()
      void (async () => {
        try {
          await consumeAIStream(
            {
              prompt,
              projectId: deps.effectiveProjectId ?? undefined,
              projectName: deps.projectName,
              command: '/build',
              activePath: primary,
              code: deps.buffersRef.current?.[primary]?.content ?? '',
              files,
              model: deps.modelChoice,
              ...(deps.categoryModels ? { categoryModels: deps.categoryModels } : {}),
              framework: deps.framework,
              targetPlatforms: deps.targetPlatforms,
              chatSessionId: deps.chatSessionId,
              useSpecKit: false,
            },
            {
              onToken: (tok) => {
                acc += tok
              },
              onDone: () => {
                applyPromise = (async () => {
                  try {
                    let result = await deps.applyStreamOpsFromText(acc, {
                      onlyPaths: targetPaths,
                    })
                    if (!result?.touched?.length) {
                      result = await deps.applyStreamOpsFromText(acc)
                    }
                    if (result?.touched?.length) {
                      deps.setIframeKey((k) => k + 1)
                      cf.running = false
                      scheduleCompileWaitTimeout()
                    } else {
                      deps.addDebug('info', 'Autofix de imports: sin cambios aplicables')
                      endCompileFixAttempt('failed')
                    }
                  } catch {
                    endCompileFixAttempt('failed')
                  }
                })()
              },
              onError: () => {
                deps.addDebug('error', 'Autofix de imports: error en stream')
                endCompileFixAttempt('failed')
              },
            },
            { signal: abortController.signal },
          )
          await applyPromise
        } catch (err) {
          const e = err as { name?: string }
          if (e?.name !== 'AbortError' && !abortController.signal.aborted) {
            deps.addDebug('error', 'Autofix de imports interrumpido')
            endCompileFixAttempt('failed')
          } else {
            endCompileFixAttempt('aborted')
          }
        } finally {
          if (cf.abort === abortController) cf.abort = null
          if (cf.running) endCompileFixAttempt('failed')
        }
      })()
    },
    [clearCompileFixBusy, deps, previewFixGaveUp, endCompileFixAttempt, scheduleCompileWaitTimeout, isAutofixEligible],
  )

  const runUndeliveredFilesFix = useCallback(
    (paths: string[]) => {
      if (!paths.length) return
      const cf = compileFixRef.current
      if (!isAutofixEligible()) return
      if (cf.gaveUp || previewFixGaveUp) return
      if (cf.running || deps.aiStreamActiveRef.current) return
      if (cf.fixing) {
        clearCompileFixBusy()
      }
      if (!deps.geminiEnabled || !deps.effectiveProjectId) return

      const knownPaths = Object.keys(deps.buffersRef.current ?? {})
      const files = knownPaths.map((path) => ({
        path,
        content: deps.buffersRef.current?.[path]?.content ?? '',
      }))
      const targetPaths = paths
      const primary = targetPaths[0] ?? 'src/App.tsx'
      const prompt = buildUndeliveredFilesFixPrompt({ paths: targetPaths, files })

      cf.running = true
      cf.fixing = true
      const abortController = new AbortController()
      cf.abort = abortController
      setCompileFixBusy(true)
      deps.pushSnapshot()
      cf.lastPrimary = primary
      deps.addDebug(
        'info',
        `Completando ${targetPaths.length} archivo(s) que el asistente mencionó pero no generó: ${targetPaths.map((p) => p.split('/').pop()).join(', ')}`,
      )

      let acc = ''
      let applyPromise = Promise.resolve()
      void (async () => {
        try {
          await consumeAIStream(
            {
              prompt,
              projectId: deps.effectiveProjectId ?? undefined,
              projectName: deps.projectName,
              command: '/build',
              activePath: primary,
              code: deps.buffersRef.current?.[primary]?.content ?? '',
              files,
              model: deps.modelChoice,
              ...(deps.categoryModels ? { categoryModels: deps.categoryModels } : {}),
              framework: deps.framework,
              targetPlatforms: deps.targetPlatforms,
              chatSessionId: deps.chatSessionId,
              useSpecKit: false,
            },
            {
              onToken: (tok) => {
                acc += tok
              },
              onDone: () => {
                applyPromise = (async () => {
                  try {
                    let result = await deps.applyStreamOpsFromText(acc, {
                      onlyPaths: targetPaths,
                    })
                    if (!result?.touched?.length) {
                      result = await deps.applyStreamOpsFromText(acc)
                    }
                    if (result?.touched?.length) {
                      deps.setIframeKey((k) => k + 1)
                      cf.running = false
                      scheduleCompileWaitTimeout()
                    } else {
                      deps.addDebug('info', 'Autocompletado de archivos: sin cambios aplicables')
                      endCompileFixAttempt('failed')
                    }
                  } catch {
                    endCompileFixAttempt('failed')
                  }
                })()
              },
              onError: () => {
                deps.addDebug('error', 'Autocompletado de archivos: error en stream')
                endCompileFixAttempt('failed')
              },
            },
            { signal: abortController.signal },
          )
          await applyPromise
        } catch (err) {
          const e = err as { name?: string }
          if (e?.name !== 'AbortError' && !abortController.signal.aborted) {
            deps.addDebug('error', 'Autocompletado de archivos interrumpido')
            endCompileFixAttempt('failed')
          } else {
            endCompileFixAttempt('aborted')
          }
        } finally {
          if (cf.abort === abortController) cf.abort = null
          if (cf.running) endCompileFixAttempt('failed')
        }
      })()
    },
    [clearCompileFixBusy, deps, previewFixGaveUp, endCompileFixAttempt, scheduleCompileWaitTimeout, isAutofixEligible],
  )

  const triggerVercelBuildFix = useCallback(
    (buildLog: string) => {
      if (!deps.autofixEnabledRef.current || !buildLog.trim()) return
      const cf = compileFixRef.current
      if (cf.gaveUp || cf.running || cf.fixing || deps.aiStreamActiveRef.current) return
      const paths = Object.keys(deps.buffersRef.current ?? {}).filter(
        (p) => p.startsWith('src/') && /\.(tsx|jsx|ts|js)$/.test(p),
      )
      const primary =
        paths.find((p) => /App\.(tsx|jsx)$/.test(p)) ?? paths[0] ?? 'src/App.tsx'
      const targetPaths = paths.length ? paths.slice(0, 8) : [primary]
      cf.attempts += 1
      setCompileFixAttempt(cf.attempts)
      deps.autofixFromChatRef.current = true
      void (async () => {
        cf.running = true
        cf.fixing = true
        setCompileFixBusy(true)
        deps.pushSnapshot()
        const prompt = buildVercelBuildFixPrompt({
          buildLog,
          path: primary,
          content: deps.buffersRef.current?.[primary]?.content ?? '',
        })
        const filesForFix = targetPaths.map((path) => ({
          path,
          content: deps.buffersRef.current?.[path]?.content ?? '',
        }))
        let acc = ''
        try {
          await consumeAIStream(
            {
              prompt,
              projectId: deps.effectiveProjectId ?? undefined,
              projectName: deps.projectName,
              command: '/build',
              activePath: primary,
              files: filesForFix,
              model: deps.modelChoice,
              ...(deps.categoryModels ? { categoryModels: deps.categoryModels } : {}),
              framework: deps.framework,
              targetPlatforms: deps.targetPlatforms,
              useSpecKit: false,
            },
            {
              onToken: (tok) => {
                acc += tok
              },
              onDone: () => {
                void deps.applyStreamOpsFromText(acc, { onlyPaths: targetPaths }).finally(() => {
                  cf.running = false
                  cf.fixing = false
                  setCompileFixBusy(false)
                  deps.setIframeKey((k) => k + 1)
                })
              },
              onError: () => {
                cf.running = false
                cf.fixing = false
                setCompileFixBusy(false)
              },
            },
          )
        } catch {
          cf.running = false
          cf.fixing = false
          setCompileFixBusy(false)
        }
      })()
    },
    [deps],
  )

  return {
    compileFixBusy,
    previewFixGaveUp,
    compileFixAttempt,
    maxCompileFixAttempts: MAX_COMPILE_FIX_ATTEMPTS,
    handleCompileError,
    handleCompileOk,
    resetCompileFixState,
    stopCompileFix,
    cancelCompileFixSilently,
    runManualCompileFix,
    runMissingImportsFix,
    runUndeliveredFilesFix,
    triggerVercelBuildFix,
    compileFixRef,
  }
}

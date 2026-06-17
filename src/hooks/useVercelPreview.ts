'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api/client'

export type VercelPreviewStatus = 'idle' | 'deploying' | 'live' | 'error'

export function useVercelPreview(projectId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<VercelPreviewStatus>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const [buildLog, setBuildLog] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollStatus = useCallback(
    async (filesHash?: string) => {
      if (!projectId) return
      const q = filesHash ? `?filesHash=${encodeURIComponent(filesHash)}` : ''
      const data = await apiFetch<{
        status?: string
        url?: string | null
        buildLog?: string | null
        errorMessage?: string | null
      }>(`/api/projects/${projectId}/preview-deploy${q}`)
      const st = data.status ?? 'idle'
      if (data.buildLog) setBuildLog(data.buildLog)
      if (data.errorMessage) setErrorMessage(data.errorMessage)
      if (st === 'ready' && data.url) {
        setUrl(data.url)
        setStatus('live')
        stopPoll()
        return
      }
      if (st === 'error') {
        setStatus('error')
        stopPoll()
        return
      }
      if (st === 'building') {
        setStatus('deploying')
      }
    },
    [projectId, stopPoll],
  )

  const deploy = useCallback(async () => {
    if (!projectId || !enabled) return
    setStatus('deploying')
    setErrorMessage(null)
    setBuildLog(null)
    try {
      const data = await apiFetch<{
        url?: string
        status?: string
        cached?: boolean
        filesHash?: string
      }>(`/api/projects/${projectId}/preview-deploy`, {
        method: 'POST',
        body: JSON.stringify({ action: 'deploy' }),
      })
      if (data.status === 'ready' && data.url) {
        setUrl(data.url)
        setStatus('live')
        return
      }
      setStatus('deploying')
      stopPoll()
      pollRef.current = setInterval(() => {
        void pollStatus(data.filesHash)
      }, 3000)
      await pollStatus(data.filesHash)
    } catch (e) {
      setStatus('error')
      setErrorMessage(e instanceof Error ? e.message : 'Error de deploy')
      stopPoll()
    }
  }, [projectId, enabled, pollStatus, stopPoll])

  const cleanup = useCallback(async () => {
    if (!projectId) return
    stopPoll()
    try {
      await apiFetch(`/api/projects/${projectId}/preview-deploy`, {
        method: 'POST',
        body: JSON.stringify({ action: 'cleanup' }),
      })
    } catch {
      /* ignore */
    }
    setStatus('idle')
    setUrl(null)
    setBuildLog(null)
    setErrorMessage(null)
  }, [projectId, stopPoll])

  useEffect(() => () => stopPoll(), [stopPoll])

  return {
    status,
    url,
    buildLog,
    errorMessage,
    deploy,
    cleanup,
    pollStatus,
  }
}

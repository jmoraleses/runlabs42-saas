import type { ChatInsightPayload } from '@/lib/ai/chatInsight'
import type { StreamToken } from '@/types'
import { formatNetworkStreamError, formatStreamErrorMessage } from '@/lib/ai/streamErrors'
import { isValidWorkspacePath } from '@/lib/projects/workspacePath'

export type StreamFile = { path: string; content: string }
export type StreamImage = { path: string; content: string; mimeType: string }

export type StreamHandlers = {
  onToken?: (text: string) => void
  onFiles?: (files: StreamFile[]) => void
  onFileDelta?: (file: StreamFile) => void
  onFileDelete?: (path: string) => void
  onImages?: (images: StreamImage[]) => void
  onPhase?: (phase: string) => void
  onPhaseModel?: (data: { phase: string; modelId: string; label: string }) => void
  onCost?: (credits: number) => void
  onScanResult?: (data: string) => void
  onBuildProgress?: (data: string) => void
  onChatInsight?: (insight: ChatInsightPayload) => void
  onDone?: () => void
  onError?: (message: string) => void
}

/**
 * Consume SSE from POST /api/stream (mock or real provider).
 */
export type ConsumeAIStreamOptions = {
  signal?: AbortSignal
}

export async function consumeAIStream(
  body: Record<string, unknown>,
  handlers: StreamHandlers,
  options?: ConsumeAIStreamOptions,
): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
      signal: options?.signal,
    })
  } catch (e) {
    const msg = formatNetworkStreamError(e)
    if (msg) {
      console.error('[AI stream] network error:', e)
      handlers.onError?.(msg)
    }
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const raw = (err as { error?: string }).error ?? res.statusText
    const msg = formatStreamErrorMessage(res.status, raw)
    console.error('[AI stream] HTTP error', res.status, raw, err)
    handlers.onError?.(msg)
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    console.error('[AI stream] No response body')
    handlers.onError?.('No response body')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
  while (true) {
    if (options?.signal?.aborted) break
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const payload = JSON.parse(line.slice(6)) as StreamToken
        if (payload.type === 'token') handlers.onToken?.(payload.data)
        if (payload.type === 'phase') handlers.onPhase?.(payload.data)
        if (payload.type === 'phase-model') {
          try {
            const parsed = JSON.parse(payload.data) as {
              phase?: string
              modelId?: string
              label?: string
            }
            if (parsed.phase && parsed.modelId) {
              handlers.onPhaseModel?.({
                phase: parsed.phase,
                modelId: parsed.modelId,
                label: parsed.label ?? parsed.modelId,
              })
            }
          } catch {
            /* ignore */
          }
        }
        if (payload.type === 'files') {
          try {
            const files = (JSON.parse(payload.data) as StreamFile[]).filter(
              (f) => f && isValidWorkspacePath(f.path),
            )
            if (files.length) handlers.onFiles?.(files)
          } catch {
            /* ignore */
          }
        }
        if (payload.type === 'file_delta') {
          try {
            const file = JSON.parse(payload.data) as StreamFile
            if (file?.path) handlers.onFileDelta?.(file)
          } catch {
            /* ignore */
          }
        }
        if (payload.type === 'file_delete') {
          handlers.onFileDelete?.(payload.data)
        }
        if (payload.type === 'images') {
          try {
            const images = JSON.parse(payload.data) as StreamImage[]
            if (images.length) handlers.onImages?.(images)
          } catch {
            /* ignore */
          }
        }
        if (payload.type === 'cost') {
          let credits = Number(payload.data)
          try {
            const parsed = JSON.parse(payload.data) as {
              credits?: number
              billableCredits?: number
            }
            if (typeof parsed.credits === 'number') credits = parsed.credits
            else if (typeof parsed.billableCredits === 'number') credits = parsed.billableCredits
          } catch {
            /* número plano */
          }
          if (Number.isFinite(credits)) handlers.onCost?.(credits)
        }
        if (payload.type === 'scan_result') handlers.onScanResult?.(payload.data)
        if (payload.type === 'build_progress') handlers.onBuildProgress?.(payload.data)
        if (payload.type === 'chat_insight') {
          try {
            const insight = JSON.parse(payload.data) as ChatInsightPayload
            if (insight?.typology && insight.summary) handlers.onChatInsight?.(insight)
          } catch {
            /* ignore */
          }
        }
        if (payload.type === 'error') {
          console.error('[AI stream] error event:', payload.data)
          handlers.onError?.(payload.data)
        }
        if (payload.type === 'done') handlers.onDone?.()
      } catch (e) {
        console.warn('[AI stream] malformed chunk:', line, e)
      }
    }
  }
  } catch (e) {
    const msg = formatNetworkStreamError(e)
    if (msg) {
      console.error('[AI stream] read error:', e)
      handlers.onError?.(msg)
    }
  }
}

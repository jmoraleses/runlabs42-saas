import type { StreamHandlers } from '@/lib/ai/stream'
import { formatNetworkStreamError, formatStreamErrorMessage } from '@/lib/ai/streamErrors'

export type ConsumeProjectDesignStreamOptions = {
  signal?: AbortSignal
}

function isAbortError(e: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted || (e instanceof Error && e.name === 'AbortError'))
}

export async function consumeProjectDesignStream(
  projectId: string,
  route: 'generate' | 'figma/import',
  body: Record<string, unknown>,
  handlers: StreamHandlers,
  options?: ConsumeProjectDesignStreamOptions,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`/api/projects/${projectId}/design/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...body, stream: true }),
      signal: options?.signal,
    })
  } catch (e) {
    if (isAbortError(e, options?.signal)) return
    handlers.onError?.(formatNetworkStreamError(e) ?? 'Error de red')
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    handlers.onError?.(
      formatStreamErrorMessage(res.status, (err as { error?: string }).error ?? res.statusText),
    )
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    handlers.onError?.('Sin cuerpo de respuesta')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  let sawDone = false
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
          const { type, data } = JSON.parse(line.slice(6)) as { type: string; data: string }
          if (type === 'token') handlers.onToken?.(data)
          if (type === 'phase') handlers.onPhase?.(data)
          if (type === 'files') handlers.onFiles?.(JSON.parse(data))
          if (type === 'error') handlers.onError?.(data)
          if (type === 'done') {
            sawDone = true
            handlers.onDone?.()
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch (e) {
    if (!isAbortError(e, options?.signal)) throw e
  } finally {
    reader.cancel().catch(() => {})
  }

  if (options?.signal?.aborted) return
  if (!sawDone) handlers.onDone?.()
}

export async function consumeDesignGenerateStream(
  projectId: string,
  body: Record<string, unknown>,
  handlers: StreamHandlers,
  options?: ConsumeProjectDesignStreamOptions,
): Promise<void> {
  return consumeProjectDesignStream(projectId, 'generate', body, handlers, options)
}

export async function consumeFigmaImportStream(
  projectId: string,
  body: Record<string, unknown>,
  handlers: StreamHandlers,
  options?: ConsumeProjectDesignStreamOptions,
): Promise<void> {
  return consumeProjectDesignStream(projectId, 'figma/import', body, handlers, options)
}

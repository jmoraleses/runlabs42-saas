import type { StreamHandlers } from '@/lib/ai/stream'
import { formatNetworkStreamError, formatStreamErrorMessage } from '@/lib/ai/streamErrors'

export type ConsumeDesignConvertStreamOptions = {
  signal?: AbortSignal
}

function isAbortError(e: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted || (e instanceof Error && e.name === 'AbortError'))
}

export type DesignConvertStreamBody = Record<string, unknown> & {
  codeTemplate?: string
}

export async function consumeDesignConvertStream(
  projectId: string,
  body: DesignConvertStreamBody,
  handlers: StreamHandlers,
  options?: ConsumeDesignConvertStreamOptions,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`/api/projects/${projectId}/design/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
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
  let doneEmitted = false

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
          if (type === 'files') {
            const files = JSON.parse(data) as Array<{ path: string; content: string }>
            handlers.onFiles?.(files)
          }
          if (type === 'error') handlers.onError?.(data)
          if (type === 'done' && !doneEmitted) {
            doneEmitted = true
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
  if (!doneEmitted) handlers.onDone?.()
}

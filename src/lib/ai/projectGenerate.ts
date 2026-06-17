import type { StreamFile } from '@/lib/ai/stream'

export type GenerateHandlers = {
  onPhase?: (phase: string) => void
  onToken?: (text: string) => void
  onFiles?: (files: StreamFile[]) => void
  onError?: (message: string) => void
  onDone?: () => void
}

export async function consumeProjectGenerate(
  projectId: string,
  body: Record<string, unknown>,
  handlers: GenerateHandlers,
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    handlers.onError?.((err as { error?: string }).error ?? res.statusText)
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    handlers.onError?.('No response body')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const payload = JSON.parse(line.slice(6)) as { type: string; data: string }
        if (payload.type === 'phase') handlers.onPhase?.(payload.data)
        if (payload.type === 'token') handlers.onToken?.(payload.data)
        if (payload.type === 'files') {
          const files = JSON.parse(payload.data) as StreamFile[]
          if (Array.isArray(files)) handlers.onFiles?.(files)
        }
        if (payload.type === 'error') handlers.onError?.(payload.data)
        if (payload.type === 'done') handlers.onDone?.()
      } catch {
        /* ignore */
      }
    }
  }
}

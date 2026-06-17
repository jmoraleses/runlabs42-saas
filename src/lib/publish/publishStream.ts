export type PublishStreamEvent =
  | { phase: string; message?: string; url?: string; deploymentId?: string }

export async function runPublishStream(params: {
  projectId: string
  body?: Record<string, unknown>
  onEvent: (event: PublishStreamEvent) => void
  signal?: AbortSignal
}): Promise<{ url: string; deploymentId: string }> {
  const res = await fetch(`/api/projects/${params.projectId}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.body ?? {}),
    signal: params.signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Publish failed (${res.status})`)
  }
  if (!res.body) throw new Error('Sin respuesta del servidor')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: { url: string; deploymentId: string } | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6)) as PublishStreamEvent
        params.onEvent(event)
        if (event.phase === 'done' && event.url && event.deploymentId) {
          result = { url: event.url, deploymentId: event.deploymentId }
        }
        if (event.phase === 'error') {
          throw new Error(event.message ?? 'Error al publicar')
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
    }
  }

  if (!result) throw new Error('Publicación incompleta')
  return result
}

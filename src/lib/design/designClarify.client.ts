import { apiFetch } from '@/lib/api/client'
import type { DesignClarifyResult } from '@/lib/design/designClarify'

export async function fetchDesignClarify(
  projectId: string,
  body: { prompt: string; model?: string; skipHeuristic?: boolean },
  signal?: AbortSignal,
): Promise<DesignClarifyResult> {
  const res = await apiFetch(`/api/projects/${projectId}/design/clarify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return (await res.json()) as DesignClarifyResult
}

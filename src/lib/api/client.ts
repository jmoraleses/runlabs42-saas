'use client'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null && init.body !== ''
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  let data: Record<string, unknown> = {}
  try {
    data = await res.json()
  } catch {
    if (!res.ok) {
      // Server returned non-JSON (HTML error page, nginx gateway error, etc.)
      const text = await res.text().catch(() => '')
      if (text) console.error('[apiFetch] non-JSON error response:', res.status, text.slice(0, 500))
      throw new Error(res.statusText || `HTTP ${res.status}`)
    }
  }
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText)
  }
  return data as T
}

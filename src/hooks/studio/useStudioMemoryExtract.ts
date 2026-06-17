'use client'

import { useCallback, useRef } from 'react'
import { isMemoryExtractEnabled } from '@/lib/studio/memoryPreferences'

export function useStudioMemoryExtract(isAuthenticated: boolean) {
  const memoryExtractRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerMemoryExtract = useCallback(
    (
      pid: string,
      userMessage: string,
      assistantMessage: string,
    ) => {
      const localDev =
        process.env.NODE_ENV === 'development' &&
        (pid.startsWith('demo-') || !isAuthenticated)
      if (!isAuthenticated && !localDev) return
      if (!userMessage?.trim()) return
      if (!isMemoryExtractEnabled()) return
      if (memoryExtractRef.current) clearTimeout(memoryExtractRef.current)
      memoryExtractRef.current = setTimeout(() => {
        void fetch('/api/memory/extract', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: pid,
            userMessage,
            assistantMessage: assistantMessage ?? '',
          }),
        }).catch((err) => console.error('[memory extract]', err))
      }, 3000)
    },
    [isAuthenticated],
  )

  return { triggerMemoryExtract }
}

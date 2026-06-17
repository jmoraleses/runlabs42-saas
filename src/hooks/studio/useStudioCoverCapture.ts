'use client'

import { useCallback, useRef } from 'react'
import type { WorkspaceBuffers } from '@/lib/ai/applyFileOperations'
import {
  captureAndSaveAllPages,
  findPreviewIframe,
  waitForPreviewReady,
} from '@/lib/projects/coverCapture'
import { getPreviewRouteFromIframe } from '@/lib/preview/previewNavigation'

export function useStudioCoverCapture(
  buffersRef: React.RefObject<WorkspaceBuffers>,
  coverCaptureIframeRef: React.RefObject<HTMLIFrameElement | null>,
) {
  const coverCaptureInFlightRef = useRef(false)
  const coverCapturedRef = useRef(false)

  const triggerCoverCapture = useCallback(
    async (pid: string, onCoverUrl?: (url: string) => void) => {
      if (!pid || coverCaptureInFlightRef.current) return
      coverCaptureInFlightRef.current = true
      try {
        const files = Object.entries(buffersRef.current ?? {}).map(([path, b]) => ({
          path,
          content: b?.content ?? '',
        }))
        const visibleIframe = findPreviewIframe()
        const workerIframe = coverCaptureIframeRef.current ?? visibleIframe
        if (workerIframe) {
          await waitForPreviewReady(workerIframe, 25_000)
        }
        const currentRoute = visibleIframe
          ? getPreviewRouteFromIframe(visibleIframe)
          : '/'
        const urls = await captureAndSaveAllPages(pid, files, workerIframe, {
          currentRoute,
        })
        const coverUrl = urls[0]
        if (coverUrl) {
          onCoverUrl?.(coverUrl)
          coverCapturedRef.current = true
        }
      } catch {
        /* best-effort */
      } finally {
        coverCaptureInFlightRef.current = false
      }
    },
    [buffersRef, coverCaptureIframeRef],
  )

  return {
    triggerCoverCapture,
    coverCapturedRef,
    coverCaptureInFlightRef,
  }
}

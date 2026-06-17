'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  isPreviewNavigateMessage,
  isVisualPreviewFile,
  navigatePreviewToRoute,
  normRoute,
  previewRouteForFile,
} from '@/lib/preview/previewNavigation'
import { isMessageFromPreviewIframe } from '@/lib/visual-edit/protocol'

type UsePreviewRouteSyncOptions = {
  activePath: string
  workspaceFiles?: Array<{ path: string; content: string }>
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  /** Si hay URL desplegada externa, no navegar el sandbox. */
  previewSrc?: string
  /** Recarga del iframe (p. ej. tras compilar). */
  iframeKey?: number
  /** El usuario navegó dentro del preview (Link, router). */
  onPreviewRouteFromIframe?: (route: string) => void
}

/** Al seleccionar un archivo de página, navega el preview a la ruta correspondiente. */
export function usePreviewRouteSync({
  activePath,
  workspaceFiles,
  iframeRef,
  previewSrc,
  iframeKey = 0,
  onPreviewRouteFromIframe,
}: UsePreviewRouteSyncOptions) {
  const lastRouteRef = useRef<string | null>(null)

  const syncRoute = useCallback(
    (path: string, files?: Array<{ path: string; content: string }>) => {
      if (previewSrc) return
      const iframe = iframeRef.current
      if (!iframe) return
      if (!isVisualPreviewFile(path)) return

      const route = previewRouteForFile(path, files)
      if (!route || route === lastRouteRef.current) return

      const apply = () => {
        const root = iframe.contentDocument?.querySelector('#root')
        if (!root?.childElementCount) return false
        navigatePreviewToRoute(iframe, route)
        lastRouteRef.current = route
        return true
      }

      if (apply()) return
      let attempts = 0
      const id = window.setInterval(() => {
        attempts += 1
        if (apply() || attempts > 40) window.clearInterval(id)
      }, 100)
    },
    [iframeRef, previewSrc],
  )

  useEffect(() => {
    syncRoute(activePath, workspaceFiles)
  }, [activePath, workspaceFiles, iframeKey, syncRoute])

  const onPreviewIframeLoad = useCallback(() => {
    lastRouteRef.current = null
    syncRoute(activePath, workspaceFiles)
  }, [activePath, workspaceFiles, syncRoute])

  useEffect(() => {
    if (!onPreviewRouteFromIframe) return
    const onMessage = (ev: MessageEvent) => {
      if (!isPreviewNavigateMessage(ev.data)) return
      if (!isMessageFromPreviewIframe(ev, iframeRef.current)) return
      const route = normRoute(ev.data.path)
      if (route === lastRouteRef.current) return
      lastRouteRef.current = route
      onPreviewRouteFromIframe(route)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [iframeRef, onPreviewRouteFromIframe])

  return { onPreviewIframeLoad, syncRoute }
}

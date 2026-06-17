'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type ElementDescriptor,
  type InsertNodeKind,
  type NodeInsertedPayload,
  type ParentToBridge,
  type VisualEditMode,
  type VisualPatch,
  VISUAL_EDIT_CHANNEL,
  isVisualEditMessage,
  isMessageFromPreviewIframe,
  postToBridge,
} from '@/lib/visual-edit/protocol'

export type UseVisualEditOptions = {
  /** Sincroniza modo y acepta mensajes de todos los iframes dentro de este contenedor (lienzo multi-página). */
  canvasRootRef?: React.RefObject<HTMLElement | null>
  /** Se invoca con el data-page-id del marco cuyo iframe envió el mensaje. */
  onMessageSourcePageId?: (pageId: string | null) => void
  /** Tras cerrar el selector de color nativo, ignora la siguiente deselección (un clic fuera). */
  preserveSelectionOnceRef?: React.MutableRefObject<boolean>
}

export function useVisualEdit(
  externalMode?: VisualEditMode,
  onExternalModeChange?: (mode: VisualEditMode) => void,
  onNodeInserted?: (payload: NodeInsertedPayload) => void,
  onHtmlUpdated?: (html: string) => void,
  onElementSelect?: (element: ElementDescriptor | null) => void,
  options?: UseVisualEditOptions,
) {
  const canvasRootRef = options?.canvasRootRef
  const onMessageSourcePageId = options?.onMessageSourcePageId
  const preserveSelectionOnceRef = options?.preserveSelectionOnceRef
  const onElementSelectRef = useRef(onElementSelect)
  onElementSelectRef.current = onElementSelect
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [internalMode, setInternalMode] = useState<VisualEditMode>('off')
  const controlled = externalMode !== undefined && onExternalModeChange !== undefined
  const mode = controlled ? externalMode : internalMode
  const modeRef = useRef<VisualEditMode>(mode)
  modeRef.current = mode
  const [bridgeReady, setBridgeReady] = useState(false)
  const [hovered, setHovered] = useState<ElementDescriptor | null>(null)
  const [selected, setSelected] = useState<ElementDescriptor | null>(null)
  const [patches, setPatches] = useState<VisualPatch[]>([])

  const listCanvasIframes = useCallback((): HTMLIFrameElement[] => {
    const root = canvasRootRef?.current
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLIFrameElement>('iframe.design-page-frame__iframe'))
  }, [canvasRootRef])

  const postToIframe = useCallback((iframe: HTMLIFrameElement | null, message: ParentToBridge) => {
    postToBridge(iframe, message)
  }, [])

  const send = useCallback(
    (message: ParentToBridge) => {
      const canvasIframes = listCanvasIframes()
      if (canvasIframes.length > 0) {
        canvasIframes.forEach((iframe) => postToIframe(iframe, message))
        return
      }
      postToIframe(iframeRef.current, message)
    },
    [listCanvasIframes, postToIframe],
  )

  const matchPreviewMessage = useCallback(
    (ev: MessageEvent): boolean => {
      const canvasIframes = listCanvasIframes()
      if (canvasIframes.length > 0) {
        for (const iframe of canvasIframes) {
          if (iframe.contentWindow !== ev.source) continue
          const frame = iframe.closest<HTMLElement>('[data-page-id]')
          onMessageSourcePageId?.(frame?.getAttribute('data-page-id') ?? null)
          return isMessageFromPreviewIframe(ev, iframe)
        }
        return false
      }
      onMessageSourcePageId?.(null)
      return isMessageFromPreviewIframe(ev, iframeRef.current)
    },
    [listCanvasIframes, onMessageSourcePageId],
  )

  const syncBridgeMode = useCallback(
    (nextMode: VisualEditMode = modeRef.current) => {
      const msgInit = {
        channel: VISUAL_EDIT_CHANNEL,
        type: 'init' as const,
        payload: { mode: nextMode },
      }
      const msgMode = {
        channel: VISUAL_EDIT_CHANNEL,
        type: 'set-mode' as const,
        payload: { mode: nextMode },
      }
      const canvasIframes = listCanvasIframes()
      if (canvasIframes.length > 0) {
        canvasIframes.forEach((iframe) => {
          postToIframe(iframe, msgInit)
          postToIframe(iframe, msgMode)
        })
        return
      }
      postToIframe(iframeRef.current, msgInit)
      postToIframe(iframeRef.current, msgMode)
    },
    [listCanvasIframes, postToIframe],
  )

  const setMode = useCallback(
    (next: VisualEditMode) => {
      if (controlled) onExternalModeChange!(next)
      else setInternalMode(next)
      if (next === 'off') setSelected(null)
    },
    [controlled, onExternalModeChange],
  )

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (!matchPreviewMessage(ev)) return
      if (!isVisualEditMessage(ev.data) || ev.data.channel !== VISUAL_EDIT_CHANNEL) return
      const msg = ev.data
      if (msg.type === 'bridge-ready') {
        setBridgeReady(true)
        syncBridgeMode(modeRef.current)
      }
      if (msg.type === 'element-hover') setHovered(msg.payload ?? null)
      if (msg.type === 'element-select') {
        if (!msg.payload && preserveSelectionOnceRef?.current) {
          preserveSelectionOnceRef.current = false
          return
        }
        setSelected(msg.payload ?? null)
        onElementSelectRef.current?.(msg.payload ?? null)
      }
      if (msg.type === 'node-inserted') {
        setSelected(msg.payload.element)
        onNodeInserted?.(msg.payload)
      }
      if (msg.type === 'html-updated') {
        onHtmlUpdated?.(msg.payload.html)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onNodeInserted, onHtmlUpdated, syncBridgeMode, matchPreviewMessage])

  useEffect(() => {
    syncBridgeMode(mode)
  }, [mode, syncBridgeMode])

  const handleIframeLoad = useCallback(() => {
    setBridgeReady(false)
    setSelected(null)
    setHovered(null)
    syncBridgeMode(modeRef.current)
    send({ channel: VISUAL_EDIT_CHANNEL, type: 'ping' })
    window.setTimeout(() => {
      send({ channel: VISUAL_EDIT_CHANNEL, type: 'ping' })
      syncBridgeMode(modeRef.current)
    }, 50)
    window.setTimeout(() => syncBridgeMode(modeRef.current), 200)
  }, [send, syncBridgeMode])

  useEffect(() => {
    const t = window.setTimeout(() => {
      send({ channel: VISUAL_EDIT_CHANNEL, type: 'ping' })
      syncBridgeMode(modeRef.current)
    }, 0)
    return () => window.clearTimeout(t)
  }, [send, syncBridgeMode])

  const applyPatch = useCallback(
    (patch: VisualPatch) => {
      setPatches((p) => [...p.filter((x) => !(x.skId === patch.skId && x.property === patch.property)), patch])
      send({ channel: VISUAL_EDIT_CHANNEL, type: 'apply-patch', payload: patch })
    },
    [send],
  )

  const highlight = useCallback(
    (skId: string | null) => {
      send({
        channel: VISUAL_EDIT_CHANNEL,
        type: 'highlight',
        payload: skId ? { skId } : null,
      })
    },
    [send],
  )

  const clearSelection = useCallback(() => {
    setSelected(null)
    send({
      channel: VISUAL_EDIT_CHANNEL,
      type: 'highlight',
      payload: null,
    })
    send({ channel: VISUAL_EDIT_CHANNEL, type: 'set-mode', payload: { mode: modeRef.current } })
  }, [send])

  const beginPlacement = useCallback(
    (kind: InsertNodeKind) => {
      send({ channel: VISUAL_EDIT_CHANNEL, type: 'begin-placement', payload: { kind } })
      if (controlled) onExternalModeChange!('select')
      else setInternalMode('select')
    },
    [controlled, onExternalModeChange, send],
  )

  const cancelPlacement = useCallback(() => {
    send({ channel: VISUAL_EDIT_CHANNEL, type: 'cancel-placement' })
  }, [send])

  const moveSibling = useCallback(
    (skId: string, direction: 'up' | 'down') => {
      send({
        channel: VISUAL_EDIT_CHANNEL,
        type: 'move-sibling',
        payload: { skId, direction },
      })
    },
    [send],
  )

  const pickAtPoint = useCallback(
    (clientX: number, clientY: number): Promise<ElementDescriptor | null> =>
      new Promise((resolve) => {
        const onMessage = (ev: MessageEvent) => {
          if (!matchPreviewMessage(ev)) return
          if (!isVisualEditMessage(ev.data) || ev.data.channel !== VISUAL_EDIT_CHANNEL) return
          if (ev.data.type !== 'pin-picked') return
          window.removeEventListener('message', onMessage)
          resolve(ev.data.payload.element ?? null)
        }
        window.addEventListener('message', onMessage)
        send({
          channel: VISUAL_EDIT_CHANNEL,
          type: 'pick-at-point',
          payload: { clientX, clientY },
        })
        window.setTimeout(() => {
          window.removeEventListener('message', onMessage)
          resolve(null)
        }, 400)
      }),
    [send, matchPreviewMessage],
  )

  return {
    iframeRef,
    mode,
    setMode,
    setVisualMode: setMode,
    syncBridgeMode,
    bridgeReady,
    hovered,
    selected,
    patches,
    applyPatch,
    highlight,
    clearSelection,
    beginPlacement,
    cancelPlacement,
    moveSibling,
    pickAtPoint,
    send,
    handleIframeLoad,
  }
}

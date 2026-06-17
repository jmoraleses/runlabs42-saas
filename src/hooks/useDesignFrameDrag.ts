'use client'

import { useCallback, useRef, useState } from 'react'
import type { DesignPageMeta } from '@/lib/design/types'

type DragState = {
  pageId: string
  startClientX: number
  startClientY: number
  originX: number
  originY: number
}

const FRAME_CLICK_MAX_PX = 6

type UseDesignFrameDragOptions = {
  enabled: boolean
  scale: number
  onSelectPage: (pageId: string) => void
  /** Clic sin arrastre (p. ej. marcador page1 en el chat). */
  onFrameClick?: (pageId: string) => void
  onCommitPosition: (pageId: string, x: number, y: number) => void | Promise<void>
}

export function useDesignFrameDrag({
  enabled,
  scale,
  onSelectPage,
  onFrameClick,
  onCommitPosition,
}: UseDesignFrameDragOptions) {
  const dragRef = useRef<DragState | null>(null)
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({})

  const resolvePagePosition = useCallback(
    (page: DesignPageMeta) => {
      const o = offsets[page.id]
      return {
        x: o?.x ?? page.x ?? 0,
        y: o?.y ?? page.y ?? 0,
      }
    },
    [offsets],
  )

  const onFramePointerDown = useCallback(
    (page: DesignPageMeta, e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return
      if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return
      e.preventDefault()
      e.stopPropagation()
      onSelectPage(page.id)
      const pos = resolvePagePosition(page)
      dragRef.current = {
        pageId: page.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [enabled, onSelectPage, resolvePagePosition],
  )

  const onFramePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || !enabled) return
      const dx = (e.clientX - drag.startClientX) / scale
      const dy = (e.clientY - drag.startClientY) / scale
      setOffsets((prev) => ({
        ...prev,
        [drag.pageId]: {
          x: Math.round(drag.originX + dx),
          y: Math.round(drag.originY + dy),
        },
      }))
    },
    [enabled, scale],
  )

  const onFramePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = (e.clientX - drag.startClientX) / scale
      const dy = (e.clientY - drag.startClientY) / scale
      const movedPx = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY)
      const x = Math.round(drag.originX + dx)
      const y = Math.round(drag.originY + dy)
      const pageId = drag.pageId
      dragRef.current = null
      if (movedPx <= FRAME_CLICK_MAX_PX) {
        onFrameClick?.(pageId)
      }
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      setOffsets((prev) => ({ ...prev, [drag.pageId]: { x, y } }))
      void onCommitPosition(drag.pageId, x, y)
    },
    [scale, onCommitPosition, onFrameClick],
  )

  const clearOffsets = useCallback(() => setOffsets({}), [])

  return {
    offsets,
    resolvePagePosition,
    onFramePointerDown,
    onFramePointerMove,
    onFramePointerUp,
    clearOffsets,
    isDragging: dragRef.current != null,
  }
}

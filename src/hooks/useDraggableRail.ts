'use client'

import { useCallback, useRef, useState, type RefObject } from 'react'

type Offset = { left: number; top: number }

const EDGE_PAD = 8

function clampOffset(
  left: number,
  top: number,
  bounds: HTMLElement,
  rail: HTMLElement,
): Offset {
  const maxLeft = Math.max(EDGE_PAD, bounds.clientWidth - rail.offsetWidth - EDGE_PAD)
  const maxTop = Math.max(EDGE_PAD, bounds.clientHeight - rail.offsetHeight - EDGE_PAD)
  return {
    left: Math.min(Math.max(EDGE_PAD, left), maxLeft),
    top: Math.min(Math.max(EDGE_PAD, top), maxTop),
  }
}

function readOffset(bounds: HTMLElement, rail: HTMLElement): Offset {
  const boundsRect = bounds.getBoundingClientRect()
  const railRect = rail.getBoundingClientRect()
  return clampOffset(
    railRect.left - boundsRect.left,
    railRect.top - boundsRect.top,
    bounds,
    rail,
  )
}

/** Barra flotante arrastrable dentro de un contenedor (p. ej. canvas de preview). */
export function useDraggableRail(
  boundsRef: RefObject<HTMLElement | null>,
  railRef: RefObject<HTMLElement | null>,
) {
  const [offset, setOffset] = useState<Offset | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origLeft: number
    origTop: number
  } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement).closest('button')) return
      const bounds = boundsRef.current
      const rail = railRef.current
      if (!bounds || !rail) return

      const current = offset ?? readOffset(bounds, rail)
      if (!offset) setOffset(current)

      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: current.left,
        origTop: current.top,
      }
      setDragging(true)
      rail.setPointerCapture(e.pointerId)
    },
    [boundsRef, railRef, offset],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      const bounds = boundsRef.current
      const rail = railRef.current
      if (!drag || drag.pointerId !== e.pointerId || !bounds || !rail) return

      const next = clampOffset(
        drag.origLeft + (e.clientX - drag.startX),
        drag.origTop + (e.clientY - drag.startY),
        bounds,
        rail,
      )
      setOffset(next)
    },
    [boundsRef, railRef],
  )

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      const rail = railRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      dragRef.current = null
      setDragging(false)
      if (rail?.hasPointerCapture(e.pointerId)) {
        rail.releasePointerCapture(e.pointerId)
      }
    },
    [railRef],
  )

  const railStyle: React.CSSProperties | undefined = offset
    ? { left: offset.left, top: offset.top, transform: 'none' }
    : undefined

  return {
    offset,
    dragging,
    railStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  }
}

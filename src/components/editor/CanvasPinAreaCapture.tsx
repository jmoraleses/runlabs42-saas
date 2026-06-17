'use client'

import React, { useCallback, useRef, useState } from 'react'
import {
  clientToRectPercent,
  normalizePinAreaFromDrag,
  type PinAreaPercent,
} from '@/lib/visual-edit/canvasPinArea'
import type { CanvasPinKind } from '@/lib/visual-edit/canvasPins'

type CanvasPinAreaCaptureProps = {
  targetRef?: React.RefObject<HTMLDivElement | null>
  /** @deprecated Usa targetRef */
  canvasRef?: React.RefObject<HTMLDivElement | null>
  disabled?: boolean
  pinTone?: CanvasPinKind
  onAreaSelected: (area: PinAreaPercent) => void
}

export function CanvasPinAreaCapture({
  targetRef,
  canvasRef,
  disabled,
  pinTone = 'area',
  onAreaSelected,
}: CanvasPinAreaCaptureProps) {
  const toneClass = ` editor-pin-area-rect--tone-${pinTone}`
  const fallbackRef = useRef<HTMLDivElement | null>(null)
  const containerRef = targetRef ?? canvasRef ?? fallbackRef
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)
  const pointerIdRef = useRef<number | null>(null)

  const selectionRect =
    dragStart && dragCurrent ? normalizePinAreaFromDrag(dragStart, dragCurrent) : null

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      const target = containerRef.current
      if (!dragStart || !target) return
      const rect = target.getBoundingClientRect()
      const end = clientToRectPercent(clientX, clientY, rect)
      const area = normalizePinAreaFromDrag(dragStart, end)
      setDragStart(null)
      setDragCurrent(null)
      pointerIdRef.current = null
      onAreaSelected(area)
    },
    [containerRef, dragStart, onAreaSelected],
  )

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || e.button !== 0) return
    const target = containerRef.current
    if (!target) return
    const rect = target.getBoundingClientRect()
    const pt = clientToRectPercent(e.clientX, e.clientY, rect)
    setDragStart(pt)
    setDragCurrent(pt)
    pointerIdRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
    e.stopPropagation()
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId || !dragStart) return
    const target = containerRef.current
    if (!target) return
    const rect = target.getBoundingClientRect()
    setDragCurrent(clientToRectPercent(e.clientX, e.clientY, rect))
    e.preventDefault()
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    finishDrag(e.clientX, e.clientY)
    e.preventDefault()
  }

  function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== e.pointerId) return
    setDragStart(null)
    setDragCurrent(null)
    pointerIdRef.current = null
  }

  return (
    <>
      <div
        className="editor-pin-capture editor-pin-capture--page"
        role="presentation"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
      {selectionRect ? (
        <div
          className={`editor-pin-area-rect editor-pin-area-rect--selecting${toneClass}`}
          style={{
            left: `${selectionRect.xPercent}%`,
            top: `${selectionRect.yPercent}%`,
            width: `${selectionRect.widthPercent}%`,
            height: `${selectionRect.heightPercent}%`,
          }}
          aria-hidden
        />
      ) : null}
    </>
  )
}

'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type EditorResizeHandleProps = {
  side: 'left' | 'right'
  onResize: (delta: number) => void
  onResizeEnd?: () => void
  'aria-label'?: string
}

const RESIZE_BODY_CLASS = 'is-editor-panel-resizing'

export function EditorResizeHandle({
  side,
  onResize,
  onResizeEnd,
  'aria-label': ariaLabel = 'Redimensionar panel',
}: EditorResizeHandleProps) {
  const [dragging, setDragging] = useState(false)
  const lastX = useRef(0)

  useEffect(() => {
    if (!dragging) return
    document.body.classList.add(RESIZE_BODY_CLASS)
    return () => {
      document.body.classList.remove(RESIZE_BODY_CLASS)
    }
  }, [dragging])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      lastX.current = e.clientX
      setDragging(true)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - lastX.current
        lastX.current = ev.clientX
        onResize(side === 'left' ? delta : -delta)
      }

      const end = () => {
        setDragging(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
        onResizeEnd?.()
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
    },
    [onResize, onResizeEnd, side],
  )

  return (
    <>
      {dragging && typeof document !== 'undefined'
        ? createPortal(<div className="editor-resize-shield" aria-hidden />, document.body)
        : null}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={ariaLabel}
        className={`editor-resize-handle${dragging ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown}
      />
    </>
  )
}

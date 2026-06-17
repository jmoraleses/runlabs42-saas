'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import {
  applyPinAreaMove,
  applyPinAreaResize,
  clientToRectPercent,
  PIN_RESIZE_HANDLES,
  pinAreaWithDefaults,
  type PinAreaPercent,
  type PinResizeHandle,
} from '@/lib/visual-edit/canvasPinArea'
import type { CanvasPinKind } from '@/lib/visual-edit/canvasPins'

type CanvasPinAreaRectProps = {
  label: string
  area: PinAreaPercent
  tone?: CanvasPinKind
  variant: 'placed' | 'draft'
  badgeOnly?: boolean
  description?: string
  editable?: boolean
  boundsRef: React.RefObject<HTMLElement | null>
  onRemove?: () => void
  onAreaChange?: (area: PinAreaPercent) => void
  onEditDescription?: () => void
}

function pinRectToneClass(tone: CanvasPinKind): string {
  return ` editor-pin-area-rect--tone-${tone}`
}

type DragSession =
  | {
      mode: 'move'
      startArea: PinAreaPercent
      startPointer: { x: number; y: number }
    }
  | {
      mode: 'resize'
      handle: PinResizeHandle
      startArea: PinAreaPercent
    }

export function CanvasPinAreaRect({
  label,
  area,
  tone = 'area',
  variant,
  badgeOnly,
  description,
  editable = false,
  boundsRef,
  onRemove,
  onAreaChange,
  onEditDescription,
}: CanvasPinAreaRectProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const normalized = pinAreaWithDefaults(area)
  const [liveArea, setLiveArea] = useState<PinAreaPercent | null>(null)
  const liveAreaRef = useRef<PinAreaPercent | null>(null)
  const sessionRef = useRef<DragSession | null>(null)
  const displayArea = liveArea ?? normalized

  const setLive = useCallback((next: PinAreaPercent | null) => {
    liveAreaRef.current = next
    setLiveArea(next)
  }, [])

  const endSession = useCallback(() => {
    sessionRef.current = null
    setLive(null)
  }, [setLive])

  const pointerPercent = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = boundsRef.current?.getBoundingClientRect()
      if (!bounds) return null
      return clientToRectPercent(clientX, clientY, bounds)
    },
    [boundsRef],
  )

  const handleEditDescription = useCallback(
    (e: React.MouseEvent) => {
      if (!onEditDescription) return
      e.preventDefault()
      e.stopPropagation()
      endSession()
      onEditDescription()
    },
    [onEditDescription, endSession],
  )

  const beginMove = useCallback(
    (e: React.PointerEvent) => {
      if (!editable || !onAreaChange || e.detail > 1) return
      e.preventDefault()
      e.stopPropagation()
      const pt = pointerPercent(e.clientX, e.clientY)
      if (!pt) return
      sessionRef.current = {
        mode: 'move',
        startArea: normalized,
        startPointer: pt,
      }
      setLive(normalized)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [editable, onAreaChange, normalized, pointerPercent, setLive],
  )

  const beginResize = useCallback(
    (handle: PinResizeHandle) => (e: React.PointerEvent) => {
      if (!editable || !onAreaChange) return
      e.preventDefault()
      e.stopPropagation()
      sessionRef.current = {
        mode: 'resize',
        handle,
        startArea: normalized,
      }
      setLive(normalized)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [editable, onAreaChange, normalized, setLive],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current
      if (!session) return
      e.preventDefault()
      const pt = pointerPercent(e.clientX, e.clientY)
      if (!pt) return

      if (session.mode === 'move') {
        const next = applyPinAreaMove(
          session.startArea,
          pt.x - session.startPointer.x,
          pt.y - session.startPointer.y,
        )
        setLive(next)
        return
      }

      setLive(applyPinAreaResize(session.startArea, session.handle, pt))
    },
    [pointerPercent, setLive],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current
      if (!session) return
      e.preventDefault()
      e.stopPropagation()
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const finalArea = liveAreaRef.current ?? normalized
      if (onAreaChange) onAreaChange(finalArea)
      endSession()
    },
    [normalized, onAreaChange, endSession],
  )

  const variantClass =
    variant === 'draft' ? 'editor-pin-area-rect--draft' : 'editor-pin-area-rect--placed'

  return (
    <div
      className={`editor-pin-area-rect ${variantClass}${pinRectToneClass(tone)}${editable ? ' editor-pin-area-rect--editable' : ''}${liveArea ? ' is-adjusting' : ''}`}
      style={{
        left: `${displayArea.xPercent}%`,
        top: `${displayArea.yPercent}%`,
        width: `${displayArea.widthPercent}%`,
        height: `${displayArea.heightPercent}%`,
      }}
      aria-hidden={variant === 'draft' ? true : undefined}
      onPointerMove={editable ? onPointerMove : undefined}
      onPointerUp={editable ? onPointerUp : undefined}
      onPointerCancel={editable ? onPointerUp : undefined}
      onDoubleClick={onEditDescription ? handleEditDescription : undefined}
    >
      {editable ? (
        <div
          className="editor-pin-area-rect__move"
          aria-hidden
          onPointerDown={beginMove}
        />
      ) : null}
      {editable
        ? PIN_RESIZE_HANDLES.map((handle) => (
            <div
              key={handle}
              className={`editor-pin-area-rect__handle editor-pin-area-rect__handle--${handle}`}
              role="presentation"
              onPointerDown={beginResize(handle)}
            />
          ))
        : null}
      <span className="editor-pin-area-rect__badge">{label}</span>
      {!badgeOnly && description !== undefined ? (
        <div className="editor-pin-area-rect__label">
          <p className="editor-pin-area-rect__text">{description}</p>
          {onRemove ? (
            <button
              type="button"
              className="editor-pin-area-rect__remove"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              aria-label={t('chat.pins.remove').replace('{n}', label)}
            >
              ×
            </button>
          ) : null}
        </div>
      ) : onRemove ? (
        <button
          type="button"
          className="editor-pin-area-rect__remove editor-pin-area-rect__remove--corner"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={t('chat.pins.remove').replace('{n}', label)}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

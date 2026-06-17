'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { WsIcon } from '@/components/editor/webStudio/WebStudioIcons'
import {
  DESIGN_CANVAS_MAX_ZOOM_PERCENT,
  DESIGN_CANVAS_MIN_ZOOM_PERCENT,
} from '@/hooks/useDesignCanvasViewport'

type WebStudioZoomControlProps = {
  zoomPercent: number
  onSetZoomPercent: (pct: number) => void
  onCenter: () => void
}

function clampZoom(pct: number) {
  return Math.min(
    DESIGN_CANVAS_MAX_ZOOM_PERCENT,
    Math.max(DESIGN_CANVAS_MIN_ZOOM_PERCENT, Math.round(pct)),
  )
}

function zoomToRatio(pct: number) {
  const span = DESIGN_CANVAS_MAX_ZOOM_PERCENT - DESIGN_CANVAS_MIN_ZOOM_PERCENT
  if (span <= 0) return 0
  return (clampZoom(pct) - DESIGN_CANVAS_MIN_ZOOM_PERCENT) / span
}

function ratioToZoom(ratio: number) {
  const span = DESIGN_CANVAS_MAX_ZOOM_PERCENT - DESIGN_CANVAS_MIN_ZOOM_PERCENT
  return clampZoom(DESIGN_CANVAS_MIN_ZOOM_PERCENT + ratio * span)
}

type WebStudioZoomSliderProps = {
  zoomPercent: number
  onSetZoomPercent: (pct: number) => void
}

function WebStudioZoomSlider({ zoomPercent, onSetZoomPercent }: WebStudioZoomSliderProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      if (rect.width < 1) return
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      onSetZoomPercent(ratioToZoom(ratio))
    },
    [onSetZoomPercent],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      draggingRef.current = true
      setFromClientX(e.clientX)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [setFromClientX],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return
      e.preventDefault()
      setFromClientX(e.clientX)
    },
    [setFromClientX],
  )

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const ratio = zoomToRatio(zoomPercent)
  const thumbLeft = `${ratio * 100}%`

  return (
    <div className="web-studio-zoom__slider">
      <span className="web-studio-zoom__value" aria-live="polite">
        {zoomPercent}%
      </span>
      <div
        ref={trackRef}
        className="web-studio-zoom__track"
        role="slider"
        aria-label={t('ed.design.zoom')}
        aria-valuemin={DESIGN_CANVAS_MIN_ZOOM_PERCENT}
        aria-valuemax={DESIGN_CANVAS_MAX_ZOOM_PERCENT}
        aria-valuenow={zoomPercent}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 5
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault()
            onSetZoomPercent(zoomPercent - step)
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault()
            onSetZoomPercent(zoomPercent + step)
          } else if (e.key === 'Home') {
            e.preventDefault()
            onSetZoomPercent(DESIGN_CANVAS_MIN_ZOOM_PERCENT)
          } else if (e.key === 'End') {
            e.preventDefault()
            onSetZoomPercent(DESIGN_CANVAS_MAX_ZOOM_PERCENT)
          }
        }}
      >
        <div className="web-studio-zoom__track-line" aria-hidden />
        <div
          className="web-studio-zoom__track-fill"
          style={{ width: thumbLeft }}
          aria-hidden
        />
        <div className="web-studio-zoom__thumb" style={{ left: thumbLeft }} aria-hidden />
      </div>
    </div>
  )
}

export function WebStudioZoomControl({
  zoomPercent,
  onSetZoomPercent,
  onCenter,
}: WebStudioZoomControlProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="web-studio-zoom web-studio-zoom-control" ref={rootRef}>
      {open ? (
        <div className="web-studio-zoom__menu" role="dialog" aria-label={t('ed.design.zoom')}>
          <WebStudioZoomSlider
            zoomPercent={zoomPercent}
            onSetZoomPercent={onSetZoomPercent}
          />
          <div className="web-studio-zoom__actions">
            <button
              type="button"
              className="web-studio-zoom__action"
              onClick={() => {
                onCenter()
                setOpen(false)
              }}
            >
              {t('ed.design.zoomCenter')}
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`web-studio-zoom__pill${open ? ' is-open' : ''}`}
        aria-label={t('ed.design.zoom')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <WsIcon.Zoom size={14} className="web-studio-zoom__pill-icon" />
        <span className="web-studio-zoom__pill-value">{zoomPercent}%</span>
      </button>
    </div>
  )
}

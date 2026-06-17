'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_SCALE = 0.05
const MAX_SCALE = 1
export const DESIGN_CANVAS_DEFAULT_ZOOM_PERCENT = 20
const DEFAULT_ZOOM_SCALE = DESIGN_CANVAS_DEFAULT_ZOOM_PERCENT / 100
const CONTENT_ORIGIN_PAD = 64
const INITIAL_SCALE = DEFAULT_ZOOM_SCALE
const INITIAL_PAN = { x: 40, y: 40 }
/** Máximo |deltaY| por evento (px) para que Cmd+rueda no salte de golpe. */
const ZOOM_WHEEL_DELTA_CAP = 40
/** Factor exponencial: ~8–16 % por clic de rueda típico; acumula suave en trackpad. */
const ZOOM_WHEEL_EXP_FACTOR = 0.00336

function wheelDeltaPixels(deltaY: number, deltaMode: number): number {
  let dy = deltaY
  if (deltaMode === 1) dy *= 16
  else if (deltaMode === 2) dy *= 400
  const sign = Math.sign(dy) || 1
  return Math.min(Math.abs(dy), ZOOM_WHEEL_DELTA_CAP) * sign
}

function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const dy = wheelDeltaPixels(deltaY, deltaMode)
  return Math.exp(-dy * ZOOM_WHEEL_EXP_FACTOR)
}

export const DESIGN_CANVAS_MIN_ZOOM_PERCENT = Math.round(MIN_SCALE * 100)
export const DESIGN_CANVAS_MAX_ZOOM_PERCENT = Math.round(MAX_SCALE * 100)

/** `hand`: arrastrar el lienzo; `select`: mover marcos (el pan solo con espacio/rueda). */
export type DesignCanvasInteractionMode = 'hand' | 'select' | 'neutral'

function applyWorldTransform(
  el: HTMLElement | null,
  pan: { x: number; y: number },
  scale: number,
) {
  if (!el) return
  el.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
  el.style.transformOrigin = '0 0'
}

export function useDesignCanvasViewport(
  interactionMode: DesignCanvasInteractionMode = 'neutral',
) {
  const interactionRef = useRef(interactionMode)
  interactionRef.current = interactionMode
  const [scale, setScale] = useState(INITIAL_SCALE)
  const [pan, setPan] = useState(INITIAL_PAN)
  const scaleRef = useRef(scale)
  const panRef = useRef(pan)
  scaleRef.current = scale
  panRef.current = pan

  const panningRef = useRef(false)
  const spacePanRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const userAdjustedViewRef = useRef(false)
  const wheelLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  const syncZoomLabel = useCallback(() => {
    setPan({ ...panRef.current })
    setScale(scaleRef.current)
  }, [])

  const scheduleZoomLabelSync = useCallback(() => {
    if (wheelLabelTimerRef.current) clearTimeout(wheelLabelTimerRef.current)
    wheelLabelTimerRef.current = setTimeout(() => {
      wheelLabelTimerRef.current = null
      syncZoomLabel()
    }, 120)
  }, [syncZoomLabel])

  const applyView = useCallback(
    (nextPan: { x: number; y: number }, nextScale: number, syncReact = false) => {
      panRef.current = nextPan
      scaleRef.current = nextScale
      applyWorldTransform(worldRef.current, nextPan, nextScale)
      if (syncReact) {
        setPan(nextPan)
        setScale(nextScale)
      }
    },
    [],
  )

  useEffect(() => {
    applyWorldTransform(worldRef.current, panRef.current, scaleRef.current)
  }, [])

  useEffect(
    () => () => {
      if (wheelLabelTimerRef.current) clearTimeout(wheelLabelTimerRef.current)
    },
    [],
  )

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const zoomGesture = e.ctrlKey || e.metaKey || e.altKey
      if (!zoomGesture) return
      e.preventDefault()
      e.stopPropagation()
      const el = viewportRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const prev = scaleRef.current
      const next = clampScale(prev * wheelZoomFactor(e.deltaY, e.deltaMode))
      userAdjustedViewRef.current = true
      const p = panRef.current
      const nextPan =
        prev > 0
          ? {
              x: mx - (mx - p.x) * (next / prev),
              y: my - (my - p.y) * (next / prev),
            }
          : p
      applyView(nextPan, next, false)
      scheduleZoomLabelSync()
    },
    [applyView, scheduleZoomLabelSync],
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const mode = interactionRef.current
    const target = e.target as HTMLElement
    const onFrame = target.closest('.design-page-frame, .stitch-prototype-frame, .stitch-ds-frame')

    if (mode === 'select' && onFrame) return

    let handPan = e.button === 1 || spacePanRef.current
    if (e.button === 0 && !spacePanRef.current) {
      if (mode === 'hand') {
        // Mano: siempre desplaza el lienzo (encima de una página o no).
        handPan = true
      } else if (mode === 'select') {
        handPan = Boolean(target.closest('[data-canvas-pan]') && !onFrame)
      } else {
        handPan = Boolean(target.closest('[data-canvas-pan]'))
      }
    }
    if (!handPan) return
    if (
      mode !== 'hand' &&
      e.button === 0 &&
      target.closest('.design-page-frame__device')
    ) {
      return
    }
    e.preventDefault()
    panningRef.current = true
    userAdjustedViewRef.current = true
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!panningRef.current) return
      const nextPan = {
        x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
      }
      applyView(nextPan, scaleRef.current, false)
    },
    [applyView],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!panningRef.current) return
      panningRef.current = false
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      applyView(panRef.current, scaleRef.current, true)
    },
    [applyView],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const t = e.target as HTMLElement
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
        spacePanRef.current = true
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spacePanRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const zoomIn = useCallback(() => {
    userAdjustedViewRef.current = true
    applyView(panRef.current, clampScale(scaleRef.current * 1.15), true)
  }, [applyView])

  const zoomOut = useCallback(() => {
    userAdjustedViewRef.current = true
    applyView(panRef.current, clampScale(scaleRef.current / 1.15), true)
  }, [applyView])

  const setZoomPercent = useCallback(
    (pct: number) => {
      userAdjustedViewRef.current = true
      const nextScale = clampScale(pct / 100)
      const prevScale = scaleRef.current
      const prevPan = panRef.current
      const el = viewportRef.current
      if (!el || prevScale <= 0) {
        applyView(prevPan, nextScale, true)
        return
      }
      // Mantiene estable el punto central visible del viewport al cambiar zoom.
      const mx = el.clientWidth / 2
      const my = el.clientHeight / 2
      const nextPan = {
        x: mx - (mx - prevPan.x) * (nextScale / prevScale),
        y: my - (my - prevPan.y) * (nextScale / prevScale),
      }
      applyView(nextPan, nextScale, true)
    },
    [applyView],
  )

  const focusOnRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      const el = viewportRef.current
      if (!el || rect.width <= 0 || rect.height <= 0) return
      const pad = 56
      const sx = (el.clientWidth - pad * 2) / rect.width
      const sy = (el.clientHeight - pad * 2) / rect.height
      const nextScale = clampScale(Math.min(sx, sy, MAX_SCALE))
      const nextPan = {
        x: (el.clientWidth - rect.width * nextScale) / 2 - rect.x * nextScale,
        y: (el.clientHeight - rect.height * nextScale) / 2 - rect.y * nextScale,
      }
      userAdjustedViewRef.current = true
      applyView(nextPan, nextScale, true)
    },
    [applyView],
  )

  const applyDefaultView = useCallback(
    (bounds: { x?: number; y?: number; width: number; height: number }, opts?: { force?: boolean }) => {
      if (userAdjustedViewRef.current && !opts?.force) return false
      const el = viewportRef.current
      if (!el || bounds.width <= 0 || bounds.height <= 0) return false
      if (el.clientWidth < 48 || el.clientHeight < 48) return false
      const pad = CONTENT_ORIGIN_PAD
      const nextScale = clampScale(DEFAULT_ZOOM_SCALE)
      const anchorX = bounds.x ?? 0
      const anchorY = bounds.y ?? 0
      const nextPan = {
        // Vista inicial anclada al contenido (esquina superior izquierda real de páginas).
        x: pad - anchorX * nextScale,
        y: pad - anchorY * nextScale,
      }
      if (
        Math.abs(nextScale - scaleRef.current) < 0.001 &&
        Math.abs(nextPan.x - panRef.current.x) < 1 &&
        Math.abs(nextPan.y - panRef.current.y) < 1
      ) {
        return true
      }
      applyView(nextPan, nextScale, true)
      if (opts?.force) userAdjustedViewRef.current = false
      return true
    },
    [applyView],
  )

  const fitToContent = useCallback(
    (bounds: { x?: number; y?: number; width: number; height: number }, opts?: { force?: boolean }) => {
      if (userAdjustedViewRef.current && !opts?.force) return false
      const el = viewportRef.current
      if (!el || bounds.width <= 0 || bounds.height <= 0) return false
      if (el.clientWidth < 48 || el.clientHeight < 48) return false
      const pad = CONTENT_ORIGIN_PAD
      const sx = (el.clientWidth - pad * 2) / bounds.width
      const sy = (el.clientHeight - pad * 2) / bounds.height
      const nextScale = clampScale(Math.min(sx, sy))
      const anchorX = bounds.x ?? 0
      const anchorY = bounds.y ?? 0
      // "Ajustar" conserva anclaje superior-izquierdo del contenido en vez de centrar.
      const nextPan = {
        x: pad - anchorX * nextScale,
        y: pad - anchorY * nextScale,
      }
      if (
        Math.abs(nextScale - scaleRef.current) < 0.001 &&
        Math.abs(nextPan.x - panRef.current.x) < 1 &&
        Math.abs(nextPan.y - panRef.current.y) < 1
      ) {
        return true
      }
      applyView(nextPan, nextScale, true)
      if (opts?.force) userAdjustedViewRef.current = false
      return true
    },
    [applyView],
  )

  return {
    viewportRef,
    worldRef,
    scale,
    pan,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    zoomIn,
    zoomOut,
    setZoomPercent,
    applyDefaultView,
    fitToContent,
    focusOnRect,
    zoomPercent: Math.round(scale * 100),
    spacePanRef,
  }
}

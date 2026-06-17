'use client'

import { useEffect, useRef, useState } from 'react'
import { StitchBuildCursor } from '@/components/editor/StitchBuildCursor'
import {
  collectStitchCursorTargets,
  mapViewportPointToStage,
  stitchTipPoint,
  stitchWaypointsForRect,
} from '@/lib/design/stitchCursorTargets'

type DesignStitchCursorOverlayProps = {
  active: boolean
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  stageRef: React.RefObject<HTMLElement | null>
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/** Cursor animado sobre el iframe del lienzo, siguiendo bloques HTML en generación. */
export function DesignStitchCursorOverlay({
  active,
  iframeRef,
  stageRef,
}: DesignStitchCursorOverlayProps) {
  const posRef = useRef({ x: 12, y: 12 })
  const [pos, setPos] = useState(posRef.current)
  const seenKeysRef = useRef<Set<string>>(new Set())
  const queueRef = useRef<Array<{ x: number; y: number; dwellMs: number }>>([])
  const runningRef = useRef(false)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      seenKeysRef.current.clear()
      queueRef.current = []
      runningRef.current = false
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
      return
    }

    let cancelled = false
    let scanTimer: ReturnType<typeof setInterval> | null = null
    let idleTimer: ReturnType<typeof setInterval> | null = null
    let mo: MutationObserver | null = null

    const keyForTarget = (t: { x: number; y: number; width: number; height: number }) =>
      `${Math.round(t.x)}:${Math.round(t.y)}:${Math.round(t.width)}:${Math.round(t.height)}`

    const setPosition = (next: { x: number; y: number }) => {
      posRef.current = next
      setPos(next)
    }

    const enqueueStagePoints = (points: Array<{ x: number; y: number }>, dwellMs: number) => {
      for (const p of points) {
        queueRef.current.push({ ...p, dwellMs })
      }
      if (!runningRef.current) void drain()
    }

    const drain = async () => {
      runningRef.current = true
      while (!cancelled && queueRef.current.length) {
        const next = queueRef.current.shift()!
        const start = { ...posRef.current }
        const end = { x: next.x, y: next.y }
        const duration = 520
        const t0 = performance.now()

        await new Promise<void>((resolve) => {
          const step = (now: number) => {
            if (cancelled) {
              resolve()
              return
            }
            const t = Math.min(1, (now - t0) / duration)
            const e = easeInOut(t)
            setPosition({
              x: lerp(start.x, end.x, e),
              y: lerp(start.y, end.y, e),
            })
            if (t < 1) {
              animRef.current = requestAnimationFrame(step)
            } else {
              setPosition(end)
              resolve()
            }
          }
          animRef.current = requestAnimationFrame(step)
        })

        await new Promise((r) => setTimeout(r, next.dwellMs))
      }
      runningRef.current = false
      if (!cancelled && queueRef.current.length) void drain()
    }

    const scan = () => {
      const iframe = iframeRef.current
      const stage = stageRef.current
      const doc = iframe?.contentDocument
      if (!iframe || !stage || !doc?.body) return

      const viewport = {
        w: doc.defaultView?.innerWidth ?? 800,
        h: doc.defaultView?.innerHeight ?? 600,
      }

      for (const target of collectStitchCursorTargets(doc)) {
        const key = keyForTarget(target)
        if (seenKeysRef.current.has(key)) continue
        seenKeysRef.current.add(key)

        const rect = new DOMRect(target.x, target.y, target.width, target.height)
        const waypoints = stitchWaypointsForRect(rect, viewport).map((p) =>
          mapViewportPointToStage(p, stage),
        )
        enqueueStagePoints(waypoints, 320)
      }
    }

    const idleWander = () => {
      const iframe = iframeRef.current
      const stage = stageRef.current
      const doc = iframe?.contentDocument
      if (!iframe || !stage || !doc?.body || runningRef.current || queueRef.current.length) return

      const targets = collectStitchCursorTargets(doc)
      const pick = targets[Math.floor(Math.random() * Math.min(targets.length, 6))] ?? targets[0]
      const viewport = {
        w: doc.defaultView?.innerWidth ?? 800,
        h: doc.defaultView?.innerHeight ?? 600,
      }
      if (pick) {
        const rect = new DOMRect(pick.x, pick.y, pick.width, pick.height)
        const tip = stitchTipPoint(rect, viewport)
        enqueueStagePoints([mapViewportPointToStage(tip, stage)], 280)
        return
      }
      const iframeRect = iframe.getBoundingClientRect()
      enqueueStagePoints(
        [
          mapViewportPointToStage(
            { x: iframeRect.left + iframeRect.width * 0.25, y: iframeRect.top + iframeRect.height * 0.2 },
            stage,
          ),
          mapViewportPointToStage(
            { x: iframeRect.left + iframeRect.width * 0.55, y: iframeRect.top + iframeRect.height * 0.42 },
            stage,
          ),
        ],
        240,
      )
    }

    scan()
    scanTimer = setInterval(scan, 420)
    idleTimer = setInterval(idleWander, 1100)

    const doc = iframeRef.current?.contentDocument
    if (doc?.documentElement) {
      mo = new MutationObserver(() => scan())
      mo.observe(doc.documentElement, { childList: true, subtree: true })
    }

    const onIframeLoad = () => {
      seenKeysRef.current.clear()
      scan()
      const loaded = iframeRef.current?.contentDocument
      mo?.disconnect()
      if (loaded?.documentElement) {
        mo = new MutationObserver(() => scan())
        mo.observe(loaded.documentElement, { childList: true, subtree: true })
      }
    }
    iframeRef.current?.addEventListener('load', onIframeLoad)

    return () => {
      cancelled = true
      if (scanTimer) clearInterval(scanTimer)
      if (idleTimer) clearInterval(idleTimer)
      mo?.disconnect()
      iframeRef.current?.removeEventListener('load', onIframeLoad)
      if (animRef.current != null) cancelAnimationFrame(animRef.current)
      runningRef.current = false
    }
  }, [active, iframeRef, stageRef])

  if (!active) return null

  return (
    <div className="design-stitch-cursor-overlay" aria-hidden="true">
      <StitchBuildCursor
        variant="driven"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      />
    </div>
  )
}

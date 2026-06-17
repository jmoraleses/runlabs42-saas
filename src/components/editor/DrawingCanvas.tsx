'use client'

import React, { useCallback, useRef, useState } from 'react'

type Point = { x: number; y: number }
type Stroke = { points: Point[]; color: string; width: number }

type DrawingCanvasProps = {
  active: boolean
  color?: string
  strokeWidth?: number
  onClear?: () => void
}

function pointsToPath(points: Point[]): string {
  const first = points[0]
  if (!first) return ''
  if (points.length === 1) {
    return `M ${first.x} ${first.y} l 0.1 0`
  }
  let d = `M ${first.x} ${first.y}`
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (p) d += ` L ${p.x} ${p.y}`
  }
  return d
}

export function DrawingCanvas({ active, color = '#f97316', strokeWidth = 3, onClear }: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [current, setCurrent] = useState<Point[]>([])
  const drawing = useRef(false)

  const getPoint = useCallback((e: React.PointerEvent<SVGSVGElement>): Point => {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    }
  }, [])

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!active) return
    e.preventDefault()
    ;(e.target as SVGSVGElement).setPointerCapture(e.pointerId)
    drawing.current = true
    setCurrent([getPoint(e)])
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!active || !drawing.current) return
    e.preventDefault()
    setCurrent((prev) => [...prev, getPoint(e)])
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!active || !drawing.current) return
    drawing.current = false
    const pts = [...current, getPoint(e)]
    if (pts.length > 0) {
      setStrokes((prev) => [...prev, { points: pts, color, width: strokeWidth }])
    }
    setCurrent([])
  }

  function handleClear() {
    setStrokes([])
    setCurrent([])
    onClear?.()
  }

  if (!active && strokes.length === 0) return null

  return (
    <div className={`drawing-canvas-layer${active ? ' is-active' : ''}`}>
      <svg
        ref={svgRef}
        className="drawing-canvas-svg"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {strokes.map((stroke, i) => (
          <path
            key={i}
            d={pointsToPath(stroke.points)}
            stroke={stroke.color}
            strokeWidth={stroke.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        ))}
        {current.length > 0 ? (
          <path
            d={pointsToPath(current)}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        ) : null}
      </svg>
      {strokes.length > 0 ? (
        <button
          type="button"
          className="drawing-canvas-clear"
          onClick={handleClear}
          title="Clear drawings"
        >
          ✕ Clear
        </button>
      ) : null}
    </div>
  )
}

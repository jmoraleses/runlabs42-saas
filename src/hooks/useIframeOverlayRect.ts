'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ElementDescriptor } from '@/lib/visual-edit/protocol'

function iframeDisplayScale(iframe: HTMLIFrameElement) {
  const box = iframe.getBoundingClientRect()
  const cw = iframe.clientWidth
  const ch = iframe.clientHeight
  return {
    scaleX: cw > 0 ? box.width / cw : 1,
    scaleY: ch > 0 ? box.height / ch : 1,
  }
}

export function mapRectToCanvas(
  canvas: HTMLElement,
  iframe: HTMLIFrameElement,
  r: NonNullable<ElementDescriptor['rect']>,
) {
  const canvasBox = canvas.getBoundingClientRect()
  const iframeBox = iframe.getBoundingClientRect()
  const { scaleX, scaleY } = iframeDisplayScale(iframe)
  return {
    top: iframeBox.top - canvasBox.top + r.top * scaleY,
    left: iframeBox.left - canvasBox.left + r.left * scaleX,
    width: r.width * scaleX,
    height: r.height * scaleY,
  }
}

function rectsEqual(
  a: { top: number; left: number; width: number; height: number },
  b: { top: number; left: number; width: number; height: number },
  epsilon = 0.5,
): boolean {
  return (
    Math.abs(a.top - b.top) < epsilon &&
    Math.abs(a.left - b.left) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon
  )
}

/** Convierte rect del iframe (coords internas) a posición absoluta dentro del contenedor del canvas. */
export function useIframeOverlayRect(
  canvasRef: RefObject<HTMLElement | null>,
  iframeRef: RefObject<HTMLIFrameElement | null>,
  rect: ElementDescriptor['rect'] | null | undefined,
) {
  const [position, setPosition] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const rectRef = useRef(rect)
  const positionRef = useRef(position)
  rectRef.current = rect
  positionRef.current = position

  useEffect(() => {
    if (!rect || !canvasRef.current || !iframeRef.current) {
      setPosition(null)
      return
    }

    let raf = 0
    let followRaf = 0
    let following = false

    const applyPosition = (next: { top: number; left: number; width: number; height: number }) => {
      if (positionRef.current && rectsEqual(positionRef.current, next)) return
      positionRef.current = next
      setPosition(next)
    }

    const measure = () => {
      const r = rectRef.current
      const canvas = canvasRef.current
      const iframe = iframeRef.current
      if (!r || !canvas || !iframe) return
      applyPosition(mapRectToCanvas(canvas, iframe, r))
    }

    const scheduleMeasure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }

    const stopFollow = () => {
      following = false
      cancelAnimationFrame(followRaf)
    }

    const startFollow = () => {
      if (following) return
      following = true
      const tick = () => {
        if (!following) return
        measure()
        followRaf = requestAnimationFrame(tick)
      }
      followRaf = requestAnimationFrame(tick)
    }

    scheduleMeasure()

    window.addEventListener('resize', scheduleMeasure)
    const iframe = iframeRef.current
    iframe.contentWindow?.addEventListener('resize', scheduleMeasure)

    const canvas = canvasRef.current
    const viewport = iframe.closest('.design-pages-canvas__viewport') as HTMLElement | null
    viewport?.addEventListener('wheel', scheduleMeasure, { passive: true })

    const onPointerDown = () => startFollow()
    const onPointerUp = () => {
      stopFollow()
      scheduleMeasure()
    }
    canvas?.addEventListener('pointerdown', onPointerDown, { capture: true })
    canvas?.addEventListener('pointerup', onPointerUp)
    canvas?.addEventListener('pointercancel', onPointerUp)

    return () => {
      stopFollow()
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', scheduleMeasure)
      iframe.contentWindow?.removeEventListener('resize', scheduleMeasure)
      viewport?.removeEventListener('wheel', scheduleMeasure)
      canvas?.removeEventListener('pointerdown', onPointerDown, { capture: true })
      canvas?.removeEventListener('pointerup', onPointerUp)
      canvas?.removeEventListener('pointercancel', onPointerUp)
    }
  }, [canvasRef, iframeRef, rect])

  return position
}

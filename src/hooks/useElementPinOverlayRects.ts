'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { DesignElementContextPin } from '@/lib/design/elementContext'
import { elementPinKey } from '@/lib/design/elementContext'
import { mapRectToCanvas } from '@/hooks/useIframeOverlayRect'

export type ElementPinOverlay = {
  key: string
  label?: string
  top: number
  left: number
  width: number
  height: number
}

function findPageIframe(canvas: HTMLElement, pageId: string): HTMLIFrameElement | null {
  const frame = canvas.querySelector<HTMLElement>(`[data-page-id="${pageId}"]`)
  return frame?.querySelector<HTMLIFrameElement>('iframe.design-page-frame__iframe') ?? null
}

/** Posiciones de contorno para marcadores de elemento (herramienta lápiz) en el lienzo. */
export function useElementPinOverlayRects(
  canvasRef: RefObject<HTMLElement | null>,
  pins: DesignElementContextPin[],
) {
  const [overlays, setOverlays] = useState<ElementPinOverlay[]>([])
  const pinsRef = useRef(pins)
  pinsRef.current = pins

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pins.length) {
      setOverlays([])
      return
    }

    let raf = 0
    let followRaf = 0
    let following = false

    const measure = () => {
      const currentPins = pinsRef.current
      const c = canvasRef.current
      if (!c || !currentPins.length) {
        setOverlays([])
        return
      }

      const next: ElementPinOverlay[] = []
      for (const pin of currentPins) {
        if (!pin.rect) continue
        const iframe = findPageIframe(c, pin.pageId)
        if (!iframe) continue
        const mapped = mapRectToCanvas(c, iframe, pin.rect)
        next.push({
          key: elementPinKey(pin),
          label: pin.label,
          ...mapped,
        })
      }
      setOverlays(next)
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
    const viewport = canvas.querySelector('.design-pages-canvas__viewport') as HTMLElement | null
    viewport?.addEventListener('wheel', scheduleMeasure, { passive: true })
    const onPointerDown = () => startFollow()
    const onPointerUp = () => {
      stopFollow()
      scheduleMeasure()
    }
    canvas.addEventListener('pointerdown', onPointerDown, { capture: true })
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    const iframes = canvas.querySelectorAll<HTMLIFrameElement>('iframe.design-page-frame__iframe')
    for (const iframe of iframes) {
      iframe.contentWindow?.addEventListener('resize', scheduleMeasure)
    }

    return () => {
      stopFollow()
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', scheduleMeasure)
      viewport?.removeEventListener('wheel', scheduleMeasure)
      canvas.removeEventListener('pointerdown', onPointerDown, { capture: true })
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      for (const iframe of iframes) {
        iframe.contentWindow?.removeEventListener('resize', scheduleMeasure)
      }
    }
  }, [canvasRef, pins])

  return overlays
}

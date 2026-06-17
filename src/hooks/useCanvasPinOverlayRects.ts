'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { mapPinAreaPercentToCanvas, pinAreaWithDefaults, type PinAreaPercent } from '@/lib/visual-edit/canvasPinArea'
import type { CanvasPin, CanvasPinKind } from '@/lib/visual-edit/canvasPins'
import { canvasPrimaryPageId } from '@/lib/design/types'

export type CanvasPinOverlay = {
  pinId: string
  pageId: string
  label: string
  kind: CanvasPinKind
  area: PinAreaPercent
  top: number
  left: number
  width: number
  height: number
}

function findPageFrame(canvas: HTMLElement, pageId: string): HTMLElement | null {
  return canvas.querySelector<HTMLElement>(`[data-page-id="${pageId}"]`)
}

function findPagePinStage(canvas: HTMLElement, pageId: string): HTMLElement | null {
  const frame = findPageFrame(canvas, pageId)
  if (!frame) return null
  return (
    frame.querySelector<HTMLElement>('.design-page-frame__image-stage') ??
    frame.querySelector<HTMLElement>('.design-page-frame__preview')
  )
}

function findPagePinIframe(canvas: HTMLElement, pageId: string): HTMLIFrameElement | null {
  const frame = findPageFrame(canvas, pageId)
  return frame?.querySelector<HTMLIFrameElement>('iframe.design-page-frame__iframe') ?? null
}

/** Posiciones de marcadores de área en coordenadas del lienzo (siguen pan, zoom y arrastre de pantallas). */
export function useCanvasPinOverlayRects(
  canvasRef: RefObject<HTMLElement | null>,
  pins: CanvasPin[],
  pageLayoutKey: string,
) {
  const [overlays, setOverlays] = useState<CanvasPinOverlay[]>([])
  const pinsRef = useRef(pins)
  pinsRef.current = pins

  const measure = useCallback(() => {
    const canvas = canvasRef.current
    const currentPins = pinsRef.current
    if (!canvas || !currentPins.length) {
      setOverlays([])
      return
    }

    const next: CanvasPinOverlay[] = []
    for (const pin of currentPins) {
      const pageId = pin.pageId ? canvasPrimaryPageId(pin.pageId) : ''
      if (!pageId) continue
      const stage = findPagePinStage(canvas, pageId) ?? findPagePinStage(canvas, pin.pageId!)
      if (!stage) continue
      const iframe = findPagePinIframe(canvas, pageId)
      const box = mapPinAreaPercentToCanvas(canvas, stage, pin, { iframe })
      if (box.width < 1 || box.height < 1) continue
      const kind = pin.kind ?? 'area'
      next.push({
        pinId: pin.id,
        pageId,
        label: pin.label ?? pin.id,
        kind,
        area: pinAreaWithDefaults(pin),
        ...box,
      })
    }
    setOverlays(next)
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pins.length) {
      setOverlays([])
      return
    }

    let raf = 0
    let followRaf = 0
    let following = false

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

    const onPointerDown = () => startFollow()
    const onPointerUp = () => {
      stopFollow()
      scheduleMeasure()
    }

    scheduleMeasure()

    window.addEventListener('resize', scheduleMeasure)
    canvas.addEventListener('pointerdown', onPointerDown, { capture: true })
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    const viewport = canvas.querySelector('.design-pages-canvas__viewport') as HTMLElement | null
    viewport?.addEventListener('wheel', scheduleMeasure, { passive: true })

    const scrollCleanups: Array<() => void> = []

    const bindScrollSources = () => {
      for (const fn of scrollCleanups) fn()
      scrollCleanups.length = 0

      for (const stage of canvas.querySelectorAll<HTMLElement>(
        '.design-page-frame__preview, .design-page-frame__image-stage',
      )) {
        const onStageScroll = () => scheduleMeasure()
        stage.addEventListener('scroll', onStageScroll, { passive: true })
        scrollCleanups.push(() => stage.removeEventListener('scroll', onStageScroll))
      }

      for (const iframe of canvas.querySelectorAll<HTMLIFrameElement>(
        'iframe.design-page-frame__iframe',
      )) {
        let bound = false
        const attach = () => {
          if (bound) return true
          const win = iframe.contentWindow
          const doc = iframe.contentDocument
          if (!win || !doc) return false
          bound = true
          const onScroll = () => scheduleMeasure()
          win.addEventListener('scroll', onScroll, { passive: true })
          scrollCleanups.push(() => win.removeEventListener('scroll', onScroll))
          doc.addEventListener('scroll', onScroll, { passive: true })
          scrollCleanups.push(() => doc.removeEventListener('scroll', onScroll))
          return true
        }
        if (!attach()) {
          const onLoad = () => {
            if (attach()) scheduleMeasure()
          }
          iframe.addEventListener('load', onLoad)
          scrollCleanups.push(() => iframe.removeEventListener('load', onLoad))
        }
      }
    }

    bindScrollSources()

    // Re-measure when the viewport transform changes (zoom via slider/keyboard)
    const viewportEl = canvas.querySelector<HTMLElement>('.design-pages-canvas__viewport')
    let mutationObs: MutationObserver | null = null
    if (viewportEl) {
      mutationObs = new MutationObserver(scheduleMeasure)
      mutationObs.observe(viewportEl, { attributes: true, attributeFilter: ['style'] })
    }

    return () => {
      stopFollow()
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', scheduleMeasure)
      canvas.removeEventListener('pointerdown', onPointerDown, { capture: true })
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      viewport?.removeEventListener('wheel', scheduleMeasure)
      for (const fn of scrollCleanups) fn()
      mutationObs?.disconnect()
    }
  }, [canvasRef, pins.length, pageLayoutKey, measure])

  return overlays
}

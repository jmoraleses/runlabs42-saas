'use client'

import React from 'react'
import { CanvasPinAreaCapture } from '@/components/editor/CanvasPinAreaCapture'
import { CanvasPinMarkers } from '@/components/editor/CanvasPinMarkers'
import type { PinAreaPercent } from '@/lib/visual-edit/canvasPinArea'
import type { CanvasPin, CanvasPinKind } from '@/lib/visual-edit/canvasPins'

type DesignPagePinLayerProps = {
  stageRef: React.RefObject<HTMLDivElement | null>
  captureActive?: boolean
  pins?: CanvasPin[]
  draft?: PinAreaPercent | null
  draftLabel?: string
  draftTone?: CanvasPinKind
  pinCaptureTone?: CanvasPinKind
  pinsEditable?: boolean
  onPinAreaChange?: (id: string, area: PinAreaPercent) => void
  onPinEdit?: (id: string) => void
  onAreaSelected?: (area: PinAreaPercent) => void
  onRemovePin?: (id: string) => void
  /** Marcadores colocados se dibujan en el lienzo (siguen pan/zoom y arrastre de pantalla). */
  placedPinsHostedOnCanvas?: boolean
}

export function DesignPagePinLayer({
  stageRef,
  captureActive = false,
  pins = [],
  draft = null,
  draftLabel,
  draftTone = 'area',
  pinCaptureTone = 'area',
  pinsEditable = false,
  onPinAreaChange,
  onPinEdit,
  onAreaSelected,
  onRemovePin,
  placedPinsHostedOnCanvas = false,
}: DesignPagePinLayerProps) {
  const placedPins = placedPinsHostedOnCanvas ? [] : pins
  const showLayer = captureActive || placedPins.length > 0 || draft
  if (!showLayer) return null

  return (
    <div className="design-page-frame__pins-layer" aria-live="polite">
      {captureActive && !draft && onAreaSelected ? (
        <CanvasPinAreaCapture
          targetRef={stageRef}
          pinTone={pinCaptureTone}
          onAreaSelected={onAreaSelected}
        />
      ) : null}
      <CanvasPinMarkers
        pins={placedPins}
        draft={draft}
        draftLabel={draftLabel}
        draftTone={draftTone}
        editable={pinsEditable}
        boundsRef={stageRef}
        onPinAreaChange={onPinAreaChange}
        onPinEdit={onPinEdit}
        badgeOnly
        onRemovePin={onRemovePin}
      />
    </div>
  )
}

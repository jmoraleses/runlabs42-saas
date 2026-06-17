'use client'

import React, { useRef } from 'react'
import { CanvasPinAreaRect } from '@/components/editor/CanvasPinAreaRect'
import type { CanvasPinOverlay } from '@/hooks/useCanvasPinOverlayRects'
import type { PinAreaPercent } from '@/lib/visual-edit/canvasPinArea'

type DesignCanvasPinOverlaysProps = {
  overlays: CanvasPinOverlay[]
  editable?: boolean
  onPinAreaChange?: (pinId: string, area: PinAreaPercent) => void
  onPinEdit?: (pinId: string) => void
  onRemovePin?: (pinId: string) => void
}

function CanvasPinOverlayItem({
  overlay,
  editable,
  onPinAreaChange,
  onPinEdit,
  onRemovePin,
}: {
  overlay: CanvasPinOverlay
  editable?: boolean
  onPinAreaChange?: (pinId: string, area: PinAreaPercent) => void
  onPinEdit?: (pinId: string) => void
  onRemovePin?: (pinId: string) => void
}) {
  const boundsRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className="design-canvas-pin-overlay-host"
      style={{
        position: 'absolute',
        top: overlay.top,
        left: overlay.left,
        width: overlay.width,
        height: overlay.height,
        zIndex: 22,
        pointerEvents: editable ? 'auto' : 'none',
      }}
    >
      <div ref={boundsRef} className="design-canvas-pin-overlay-host__bounds">
        <CanvasPinAreaRect
          label={overlay.label}
          area={overlay.area}
          tone={overlay.kind}
          variant="placed"
          badgeOnly
          editable={Boolean(editable && onPinAreaChange)}
          boundsRef={boundsRef}
          onAreaChange={
            onPinAreaChange ? (area) => onPinAreaChange(overlay.pinId, area) : undefined
          }
          onEditDescription={onPinEdit ? () => onPinEdit(overlay.pinId) : undefined}
          onRemove={onRemovePin ? () => onRemovePin(overlay.pinId) : undefined}
        />
      </div>
    </div>
  )
}

export function DesignCanvasPinOverlays({
  overlays,
  editable,
  onPinAreaChange,
  onPinEdit,
  onRemovePin,
}: DesignCanvasPinOverlaysProps) {
  if (!overlays.length) return null

  return (
    <>
      {overlays.map((overlay) => (
        <CanvasPinOverlayItem
          key={overlay.pinId}
          overlay={overlay}
          editable={editable}
          onPinAreaChange={onPinAreaChange}
          onPinEdit={onPinEdit}
          onRemovePin={onRemovePin}
        />
      ))}
    </>
  )
}

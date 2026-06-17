'use client'

import React from 'react'
import { CanvasPinAreaRect } from '@/components/editor/CanvasPinAreaRect'
import type { PinAreaPercent } from '@/lib/visual-edit/canvasPinArea'
import type { CanvasPin, CanvasPinKind } from '@/lib/visual-edit/canvasPins'

type CanvasPinMarkersProps = {
  pins: CanvasPin[]
  draft?: PinAreaPercent | null
  draftLabel?: string
  draftTone?: CanvasPinKind
  editable?: boolean
  boundsRef?: React.RefObject<HTMLElement | null>
  onPinAreaChange?: (id: string, area: PinAreaPercent) => void
  onPinEdit?: (id: string) => void
  onRemovePin?: (id: string) => void
  badgeOnly?: boolean
}

export function CanvasPinMarkers({
  pins,
  draft,
  draftLabel,
  draftTone = 'area',
  editable = false,
  boundsRef,
  onPinAreaChange,
  onPinEdit,
  onRemovePin,
  badgeOnly,
}: CanvasPinMarkersProps) {
  const canEdit = Boolean(editable && boundsRef && onPinAreaChange)

  return (
    <div className="editor-canvas-pins-layer" aria-live="polite">
      {pins.map((pin, index) => (
        <CanvasPinAreaRect
          key={pin.id}
          label={pin.label ?? String(index + 1)}
          area={pin}
          tone={pin.kind ?? 'area'}
          variant="placed"
          badgeOnly={badgeOnly}
          description={badgeOnly ? undefined : pin.description}
          editable={canEdit}
          boundsRef={boundsRef!}
          onAreaChange={(area) => onPinAreaChange?.(pin.id, area)}
          onEditDescription={onPinEdit ? () => onPinEdit(pin.id) : undefined}
          onRemove={onRemovePin ? () => onRemovePin(pin.id) : undefined}
        />
      ))}

      {draft && boundsRef ? (
        <CanvasPinAreaRect
          label={draftLabel ?? String(pins.length + 1)}
          area={draft}
          tone={draftTone}
          variant="draft"
          badgeOnly
          boundsRef={boundsRef}
        />
      ) : null}
    </div>
  )
}

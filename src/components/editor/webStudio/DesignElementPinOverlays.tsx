'use client'

import React from 'react'
import type { ElementPinOverlay } from '@/hooks/useElementPinOverlayRects'

type DesignElementPinOverlaysProps = {
  overlays: ElementPinOverlay[]
}

export function DesignElementPinOverlays({ overlays }: DesignElementPinOverlaysProps) {
  if (!overlays.length) return null

  return (
    <>
      {overlays.map((overlay) => (
        <div
          key={overlay.key}
          className="editor-selection-box editor-selection-box--element-pin"
          style={{
            top: overlay.top,
            left: overlay.left,
            width: overlay.width,
            height: overlay.height,
          }}
        >
          {overlay.label ? (
            <span className="editor-selection-box__pin-label">{overlay.label}</span>
          ) : null}
        </div>
      ))}
    </>
  )
}

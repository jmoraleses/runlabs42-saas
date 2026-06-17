'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'
import type { DesignPageMeta } from '@/lib/design/types'

type StitchPrototypeFrameProps = {
  page: DesignPageMeta
  selected?: boolean
  projectName?: string
  onSelect?: () => void
  onDoubleClick?: () => void
  onPlay?: () => void
  moveMode?: boolean
  onMovePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onMovePointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void
  onMovePointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void
}

export function StitchPrototypeFrame({
  page,
  selected,
  projectName,
  onSelect,
  onDoubleClick,
  onPlay,
  moveMode = false,
  onMovePointerDown,
  onMovePointerMove,
  onMovePointerUp,
}: StitchPrototypeFrameProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const w = page.width ?? 320
  const h = page.height ?? 640

  return (
    <div
      className={`stitch-prototype-frame${selected ? ' is-selected' : ''}${moveMode ? ' design-page-frame--move' : ''}`}
      style={{ left: page.x ?? 0, top: page.y ?? 0, width: w, height: h + 36 }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDoubleClick?.()
      }}
      onPointerDown={onMovePointerDown}
      onPointerMove={onMovePointerMove}
      onPointerUp={onMovePointerUp}
      onPointerCancel={onMovePointerUp}
    >
      <div className="stitch-prototype-frame__chrome">
        <span className="stitch-prototype-frame__label">{page.name}</span>
        <button
          type="button"
          className="stitch-prototype-frame__play"
          onClick={(e) => {
            e.stopPropagation()
            onPlay?.()
          }}
        >
          ▶ {t('ed.design.playPrototype')}
        </button>
      </div>
      <div className="stitch-prototype-frame__body">
        <div className="stitch-prototype-frame__icon" aria-hidden>
          📱
        </div>
        <p className="stitch-prototype-frame__title">{projectName}</p>
        <p className="stitch-prototype-frame__hint">{t('ed.design.prototypeFrameHint')}</p>
      </div>
    </div>
  )
}

'use client'

import '@/lib/design/designLoadingGradient.css'
import { StitchBuildCursor } from '@/components/editor/StitchBuildCursor'

type DesignFrameLoadingGradientProps = {
  /** Pantalla completa (degradado al 50% sobre el preview). */
  variant?: 'full' | 'mockupOverlay'
  /** @deprecated Usa variant="mockupOverlay" */
  overlay?: boolean
  /** En overlay sobre iframe el cursor va dentro del preview (script inyectado). */
  showCursor?: boolean
}

/** Degradado azul suave animado. */
export function DesignFrameLoadingGradient({
  variant = 'full',
  overlay = false,
  showCursor,
}: DesignFrameLoadingGradientProps) {
  const resolved =
    variant === 'mockupOverlay' || overlay ? 'mockupOverlay' : 'full'
  const cursorVisible =
    showCursor ?? resolved === 'full'
  return (
    <div
      className={`rl42-blue-aurora${resolved === 'mockupOverlay' ? ' rl42-blue-aurora--mockup-overlay' : ''}`}
      aria-hidden="true"
    >
      <span className="rl42-blue-aurora__blob rl42-blue-aurora__blob--1" />
      <span className="rl42-blue-aurora__blob rl42-blue-aurora__blob--2" />
      <span className="rl42-blue-aurora__blob rl42-blue-aurora__blob--3" />
      <span className="rl42-blue-aurora__shine" />
      {cursorVisible ? <StitchBuildCursor variant="canvas" /> : null}
    </div>
  )
}

'use client'

type StitchBuildCursorProps = {
  /** En el lienzo con posición fijada por JS (overlay de generación). */
  variant?: 'canvas' | 'fixed' | 'driven'
  style?: React.CSSProperties
}

/** Cursor azul animado mientras se genera una pantalla (estilo Google Stitch). */
export function StitchBuildCursor({ variant = 'canvas', style }: StitchBuildCursorProps) {
  const className = [
    'rl42-stitch-cursor',
    variant === 'canvas' && 'rl42-stitch-cursor--canvas',
    variant === 'driven' && 'rl42-stitch-cursor--driven',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} style={style} aria-hidden="true">
      <svg
        className="rl42-stitch-cursor__icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M5.5 3.5L18 11.2L11.8 12.4L9.6 19.8L5.5 3.5Z"
          fill="#2563EB"
          stroke="#fff"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="5.5" cy="3.5" r="2.2" fill="#60A5FA" opacity="0.9" />
      </svg>
      <span className="rl42-stitch-cursor__pulse" />
    </div>
  )
}

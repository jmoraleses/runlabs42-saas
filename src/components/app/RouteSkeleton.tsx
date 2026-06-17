'use client'

export function RouteSkeleton({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 60px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 14,
      }}
    >
      {label}
    </div>
  )
}

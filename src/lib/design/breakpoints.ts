export type DesignPreviewBreakpoint = 'mobile' | 'tablet' | 'desktop'

export const DEFAULT_DESIGN_DEVICE: DesignPreviewBreakpoint = 'desktop'

export const DESIGN_BREAKPOINT_PRESETS: Record<
  DesignPreviewBreakpoint,
  { width: number; height: number; labelKey: string }
> = {
  mobile: { width: 390, height: 844, labelKey: 'ed.design.deviceMobile' },
  tablet: { width: 768, height: 1024, labelKey: 'ed.design.deviceTablet' },
  /** Alto del marco en lienzo (~1 viewport); el HTML largo hace scroll dentro del frame. */
  desktop: { width: 1280, height: 960, labelKey: 'ed.design.deviceDesktop' },
}

export function breakpointToViewport(bp: DesignPreviewBreakpoint): 'sm' | 'md' | 'lg' {
  if (bp === 'mobile') return 'sm'
  if (bp === 'tablet') return 'md'
  return 'lg'
}

export function parseDesignDevice(value: unknown): DesignPreviewBreakpoint {
  const v = String(value ?? '').toLowerCase()
  if (v === 'mobile' || v === 'smartphone' || v === 'phone') return 'mobile'
  if (v === 'tablet') return 'tablet'
  return 'desktop'
}

export function devicePromptContext(bp: DesignPreviewBreakpoint): string {
  const preset = DESIGN_BREAKPOINT_PRESETS[bp]
  const label =
    bp === 'desktop' ? 'escritorio (PC)' : bp === 'tablet' ? 'tablet' : 'móvil (smartphone)'
  const layoutNote =
    bp === 'desktop'
      ? 'Genera un diseño desktop real: navegación horizontal, contenido multi-columna y uso del ancho completo del frame. No pongas un layout móvil de ~390px centrado dentro del frame.'
      : bp === 'tablet'
        ? 'Genera un diseño tablet que use el ancho ~768px con grids de 2 columnas donde tenga sentido.'
        : 'Genera un diseño móvil de una columna optimizado para touch.'
  return (
    `\n\n## Dispositivo objetivo (obligatorio)\n` +
    `Target: ${label}.\n` +
    `Cada página en spec/design.json: width=${preset.width}, height=${preset.height}, targetDevice="${bp}".\n` +
    `El height en spec es el alto del MARCO en el lienzo (~${preset.height}px), no la longitud total del documento; el contenido extra hace scroll dentro del preview.\n` +
    `Ancho conceptual del HTML: ${preset.width}px.\n` +
    `${layoutNote}`
  )
}

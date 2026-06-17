'use client'

import { useCallback, useEffect, useState } from 'react'

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl'

/** Alineado con tokens CSS --bp-* en styles.css */
export const BREAKPOINT_PX: Record<Breakpoint, number> = {
  sm: 390,
  md: 768,
  lg: 1024,
  xl: 1280,
}

function breakpointFromWidth(width: number): Breakpoint {
  if (width < BREAKPOINT_PX.md) return 'sm'
  if (width < BREAKPOINT_PX.lg) return 'md'
  if (width < BREAKPOINT_PX.xl) return 'lg'
  return 'xl'
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>('lg')

  const update = useCallback(() => {
    if (typeof window === 'undefined') return
    setBp(breakpointFromWidth(window.innerWidth))
  }, [])

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update])

  return bp
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export function useIsMobile(): boolean {
  return useBreakpoint() === 'sm'
}

export function useIsTablet(): boolean {
  return useBreakpoint() === 'md'
}

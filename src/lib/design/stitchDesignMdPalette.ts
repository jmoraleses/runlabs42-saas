/** Paletas Material 3 derivadas del brief para plantillas spec/design.md estilo Stitch. */

import type { DesignBrief } from '@/lib/design/designBrief'
import { seedColorFromBrief } from '@/lib/design/briefDesignDerivation'
import { m3PaletteFromSeed } from '@/lib/design/themeTokens'

/** Paleta M3 derivada del brief (semilla, hex explícitos, tipo de sitio). */
export function m3PaletteFromBrief(brief: DesignBrief): Record<string, string> {
  const seed = seedColorFromBrief(brief)
  return m3PaletteFromSeed(seed)
}

/**
 * @deprecated Usa m3PaletteFromBrief(brief). Mantenido para llamadas legacy con siteType/tone.
 */
export function m3PaletteForBrief(siteType?: string, brandTone?: string): Record<string, string> {
  const brief: DesignBrief = {
    prompt: 'legacy',
    siteType: siteType as DesignBrief['siteType'],
    brandTone,
  }
  return m3PaletteFromBrief(brief)
}

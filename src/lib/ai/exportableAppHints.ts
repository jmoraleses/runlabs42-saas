import { COMPLETE_IMPORTS_HINT } from '@/lib/ai/completeImportsHints'
import { MULTI_PAGE_APP_HINT } from '@/lib/ai/multiPageAppHints'

/** Instrucciones para generar apps exportables a web + Capacitor (móvil). */

export const EXPORTABLE_APP_SYSTEM_HINT =
  'Prioriza React + Vite SPA estática exportable a iOS/Android vía Capacitor. ' +
  'Diseño mobile-first: viewport meta, touch targets ≥44px, sin interacciones solo-hover. ' +
  'Incluye public/manifest.json e iconos PWA cuando aplique. ' +
  'No añadas páginas ni enlaces de privacidad/términos legales salvo que el usuario lo pida explícitamente. ' +
  'Evita popups para OAuth; usa rutas en la misma ventana. ' +
  'No uses APIs solo de servidor en el cliente sin backend documentado. ' +
  MULTI_PAGE_APP_HINT +
  ' ' +
  COMPLETE_IMPORTS_HINT

export function exportableContextBlock(opts?: {
  framework?: string
  targetPlatforms?: string[]
}): string {
  const parts = [EXPORTABLE_APP_SYSTEM_HINT]
  if (opts?.framework) parts.push(`Framework del proyecto: ${opts.framework}`)
  if (opts?.targetPlatforms?.length) {
    parts.push(`Plataformas objetivo: ${opts.targetPlatforms.join(', ')}`)
  }
  return parts.join('\n')
}

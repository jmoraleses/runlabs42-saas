/** Rutas que no deben ser destino por defecto de bloques sin path. */
const NON_UI_ACTIVE =
  /(^|\/)(vite\.config|vitest\.config|tsconfig|package\.json|tailwind\.config|postcss\.config|eslint|capacitor\.config)/i

const APP_CANDIDATES = ['src/App.tsx', 'src/App.jsx', 'App.tsx', 'App.jsx'] as const
const HTML_GAME_CANDIDATES = ['game.js', 'sketch.js', 'main.js', 'index.html'] as const

/**
 * Ruta por defecto para aplicar bloques de código del stream cuando el fence no incluye path.
 * Detecta proyectos HTML/canvas/p5 y usa el entry point correcto.
 */
export function resolveStreamDefaultPath(
  activePath?: string | null,
  existingPaths: string[] = [],
): string {
  const paths = existingPaths.filter(Boolean)

  // HTML-first projects (canvas game, p5, vanilla)
  const hasHtmlEntry = paths.includes('index.html') || paths.includes('src/index.html')
  if (hasHtmlEntry) {
    for (const candidate of HTML_GAME_CANDIDATES) {
      if (paths.includes(candidate)) return candidate
    }
    return 'index.html'
  }

  for (const candidate of APP_CANDIDATES) {
    if (paths.includes(candidate)) return candidate
  }
  const app = paths.find((p) => /(^|\/)App\.(tsx|jsx)$/i.test(p))
  if (app) return app

  const active = activePath?.trim()
  if (active && /\.(tsx|jsx|js|html)$/i.test(active) && !NON_UI_ACTIVE.test(active)) {
    return active
  }

  return 'src/App.tsx'
}

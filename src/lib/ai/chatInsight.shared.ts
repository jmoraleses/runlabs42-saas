/**
 * Tipología y heurísticas de chat — seguro para cliente (sin Vertex / Node).
 */

import { DEFAULT_GEMINI_MODEL } from '@/lib/ai/constants'

export const CHAT_AUX_MODEL = DEFAULT_GEMINI_MODEL

export type ProjectTypologyId =
  | 'web'
  | 'web-app'
  | 'mobile-app'
  | 'game'
  | 'creative'
  | 'landing'
  | 'dashboard'
  | 'tool'
  | 'api'
  | 'other'

export type ChatInsightPayload = {
  typology: ProjectTypologyId
  suggestedFramework?: string
  summary: string
  stackHint?: string
}

export type TypologyMeta = {
  id: ProjectTypologyId
  labelKey: string
  color: string
  glyph: string
}

export const TYPOLOGY_CATALOG: TypologyMeta[] = [
  { id: 'web', labelKey: 'chat.typology.web', color: '#4f7cff', glyph: '◫' },
  { id: 'web-app', labelKey: 'chat.typology.webApp', color: 'var(--fw-react)', glyph: '⚛' },
  { id: 'mobile-app', labelKey: 'chat.typology.mobileApp', color: '#a855f7', glyph: '▣' },
  { id: 'game', labelKey: 'chat.typology.game', color: '#10b981', glyph: '◈' },
  { id: 'creative', labelKey: 'chat.typology.creative', color: 'var(--fw-canvas-app)', glyph: '✎' },
  { id: 'landing', labelKey: 'chat.typology.landing', color: '#f59e0b', glyph: '▤' },
  { id: 'dashboard', labelKey: 'chat.typology.dashboard', color: '#06b6d4', glyph: '▦' },
  { id: 'tool', labelKey: 'chat.typology.tool', color: '#94a3b8', glyph: '⚙' },
  { id: 'api', labelKey: 'chat.typology.api', color: '#64748b', glyph: '{ }' },
  { id: 'other', labelKey: 'chat.typology.other', color: '#71717a', glyph: '◇' },
]

const TYPOLOGY_IDS = new Set(TYPOLOGY_CATALOG.map((t) => t.id))

const FRAMEWORK_IDS = new Set([
  'react',
  'next',
  'vue',
  'svelte',
  'astro',
  'solid',
  'vanilla',
  'canvas-app',
  'canvas-game',
  'p5',
  'phaser',
  'three',
])

function suggestCanvasFramework(lower: string): string {
  if (/\b(three\.?js|webgl|3d|three)\b/i.test(lower)) return 'three'
  if (/\b(phaser|tilemap|sprite\s*sheet|arcade)\b/i.test(lower)) return 'phaser'
  if (/\b(p5|partículas|particulas|generativo|procedural|sketch)\b/i.test(lower)) return 'p5'
  if (/\b(dibuj|pintar|draw|paint|pizarra|brush|lienzo)\b/i.test(lower)) return 'canvas-app'
  if (/\b(juego|game|score|enemigo|arcade|shooter)\b/i.test(lower)) return 'canvas-game'
  return 'canvas-game'
}

export function getTypologyMeta(id: ProjectTypologyId): TypologyMeta {
  return TYPOLOGY_CATALOG.find((t) => t.id === id) ?? TYPOLOGY_CATALOG[TYPOLOGY_CATALOG.length - 1]!
}

export function detectLanguageHint(text: string): 'es' | 'en' {
  const lower = text.toLowerCase()
  if (/\b(el|la|los|las|quiero|crea|juego|página|aplicación)\b/.test(lower)) return 'es'
  return 'en'
}

export function heuristicInsight(opts: {
  prompt: string
  framework?: string
  command: string
}): ChatInsightPayload {
  const lower = opts.prompt.toLowerCase()
  const lang = detectLanguageHint(opts.prompt)

  let typology: ProjectTypologyId = 'web-app'
  let suggestedFramework = opts.framework?.trim() || 'next'
  let stackHint =
    lang === 'es' ? 'React + Tailwind en el workspace' : 'React + Tailwind in the workspace'

  if (/\b(dibuj|pintar|draw|paint|pizarra|arte|illustration|sketch manual)\b/i.test(lower)) {
    typology = 'creative'
    suggestedFramework = 'canvas-app'
    stackHint =
      lang === 'es' ? 'Canvas Draw (HTML + app.js, táctil)' : 'Canvas Draw (HTML + app.js, touch-ready)'
  } else if (/\b(juego|game|phaser|canvas|p5|three\.js|3d|partículas|particulas|generativo)\b/i.test(lower)) {
    typology = /\b(juego|game|phaser|score|enemigo)\b/i.test(lower) ? 'game' : 'creative'
    suggestedFramework = suggestCanvasFramework(lower)
    stackHint = lang === 'es' ? 'HTML5 + canvas (sin React)' : 'HTML5 + canvas (no React)'
  } else if (/\b(landing|hero|marketing|waitlist)\b/i.test(lower)) {
    typology = 'landing'
    suggestedFramework = 'next'
    stackHint = lang === 'es' ? 'Next.js + secciones de marketing' : 'Next.js + marketing sections'
  } else if (/\b(dashboard|admin|panel|métricas|metrics|analytics)\b/i.test(lower)) {
    typology = 'dashboard'
    suggestedFramework = opts.framework?.trim() || 'react'
  } else if (/\b(api|rest|graphql|backend|endpoint)\b/i.test(lower)) {
    typology = 'api'
    suggestedFramework = 'next'
    stackHint = lang === 'es' ? 'Rutas API / servidor' : 'API routes / server'
  } else if (/\b(móvil|mobile|ios|android|app nativa)\b/i.test(lower)) {
    typology = 'mobile-app'
    stackHint = lang === 'es' ? 'UI adaptable + plataformas objetivo' : 'Responsive UI + target platforms'
  } else if (/\b(sitio|website|web estática|html)\b/i.test(lower) && !/\b(app|aplicación)\b/i.test(lower)) {
    typology = 'web'
    suggestedFramework = /vanilla|html/i.test(lower) ? 'vanilla' : 'next'
  } else if (/\b(herramienta|tool|utilidad|calculadora|converter)\b/i.test(lower)) {
    typology = 'tool'
  }

  if (opts.framework && FRAMEWORK_IDS.has(opts.framework)) {
    const canvasFrameworks = new Set([
      'canvas-app',
      'canvas-game',
      'p5',
      'phaser',
      'three',
      'vanilla',
    ])
    if (
      (typology !== 'game' && typology !== 'creative') ||
      canvasFrameworks.has(opts.framework)
    ) {
      suggestedFramework = opts.framework
    }
  }

  const summaryEs =
    opts.command === '/plan'
      ? `Voy a planificar un ${typology === 'game' ? 'juego' : 'proyecto'} tipo «${typology}» con ${stackHint}.`
      : `Voy a construir un proyecto tipo «${typology}» usando ${stackHint}.`
  const summaryEn =
    opts.command === '/plan'
      ? `I'll plan a ${typology} project using ${stackHint}.`
      : `I'll build a ${typology} project using ${stackHint}.`

  return {
    typology,
    suggestedFramework,
    summary: lang === 'es' ? summaryEs : summaryEn,
    stackHint,
  }
}

export function parseInsightJson(raw: string): ChatInsightPayload | null {
  const trimmed = raw.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const typology = String(parsed.typology ?? '').trim() as ProjectTypologyId
    if (!TYPOLOGY_IDS.has(typology)) return null
    const summary = String(parsed.summary ?? '').trim()
    if (!summary) return null
    const suggestedFramework = String(parsed.suggestedFramework ?? '').trim()
    const stackHint = String(parsed.stackHint ?? '').trim()
    return {
      typology,
      summary: summary.slice(0, 400),
      suggestedFramework: FRAMEWORK_IDS.has(suggestedFramework) ? suggestedFramework : undefined,
      stackHint: stackHint ? stackHint.slice(0, 120) : undefined,
    }
  } catch {
    return null
  }
}

export type BuildChatInsightInput = {
  prompt: string
  framework?: string
  command: string
  targetPlatforms?: string[]
  workspaceFileCount?: number
  projectName?: string
}

import type { VisualPatch } from './protocol'

/** Mapeo skId → fragmentos editables en código fuente (demo; futuro: plugin Vite). */
export type ElementMapEntry = {
  file: string
  /** Texto literal en el código fuente a buscar y reemplazar */
  search?: string
  /** Texto mostrado en preview.html cuando difiere del código */
  previewLiteral?: string
  /** Para parches de className: regex del atributo className */
  classNamePattern?: RegExp
  kind: 'text' | 'className' | 'inline-style'
}

export const ELEMENT_MAP: Record<string, ElementMapEntry> = {
  'pricing-badge': {
    file: 'src/App.tsx',
    search: 'Popular',
    previewLiteral: 'Most popular',
    kind: 'text',
  },
  'pricing-title': {
    file: 'src/components/PricingCard.tsx',
    search: '{plan.name}',
    previewLiteral: 'Pro',
    kind: 'text',
  },
  'pricing-subtitle': {
    file: 'src/components/PricingCard.tsx',
    search: '{plan.tag}',
    previewLiteral: 'For solo builders',
    kind: 'text',
  },
  'pricing-price': {
    file: 'src/App.tsx',
    previewLiteral: '$20',
    kind: 'text',
  },
  'pricing-period': {
    file: 'src/App.tsx',
    previewLiteral: '/mo',
    kind: 'text',
  },
  'pricing-cta': {
    file: 'src/components/PricingCard.tsx',
    search: '{plan.cta}',
    previewLiteral: 'Start 14-day trial',
    kind: 'text',
  },
  'pricing-card': {
    file: 'src/components/PricingCard.tsx',
    classNamePattern: /className=\{`([^`]+)`\}/,
    kind: 'className',
  },
  'feature-1': {
    file: 'src/App.tsx',
    previewLiteral: 'Unlimited projects',
    kind: 'text',
  },
  'feature-2': {
    file: 'src/App.tsx',
    previewLiteral: 'All Claude models',
    kind: 'text',
  },
  'feature-3': {
    file: 'src/App.tsx',
    previewLiteral: 'Publish 5 items',
    kind: 'text',
  },
}

export function patchTargetsCode(skId: string, activePath: string): boolean {
  const entry = ELEMENT_MAP[skId]
  if (!entry) return false
  const base = entry.file.split('/').pop() ?? entry.file
  return activePath === entry.file || activePath.endsWith(base)
}

export function buildPatchPromptContext(skId: string, patch: VisualPatch, label: string): string {
  return `[Elemento: ${skId} (${label})] Cambio visual: ${patch.property} → "${patch.value}"`
}

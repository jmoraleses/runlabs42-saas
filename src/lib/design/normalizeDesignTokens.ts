import type { DesignTokens } from '@/lib/design/types'
import { ensureDesignTokens } from '@/lib/design/themeTokens'

export type OrchestrationBrand = {
  tone?: string
  concept?: string
}

export type OrchestrationTokenPayload = {
  colors?: Record<string, string>
  typography?: {
    heading?: string
    body?: string
    label?: string
    baseSize?: string
    scale?: string
  }
  ui?: Record<string, string>
}

export type OrchestrationTokenEnvelope = {
  brand?: OrchestrationBrand
  tokens?: OrchestrationTokenPayload
}

export function parseOrchestrationEnvelope(raw: unknown): OrchestrationTokenEnvelope {
  if (!raw || typeof raw !== 'object') return {}
  const root = raw as Record<string, unknown>
  if (root.tokens && typeof root.tokens === 'object') {
    return {
      brand: parseBrand(root.brand),
      tokens: root.tokens as OrchestrationTokenPayload,
    }
  }
  return {
    tokens: {
      colors: (root.colors as Record<string, string>) ?? undefined,
      typography: root.typography as OrchestrationTokenPayload['typography'],
      ui: root.ui as Record<string, string>,
    },
  }
}

function parseBrand(raw: unknown): OrchestrationBrand | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const b = raw as Record<string, unknown>
  return {
    tone: typeof b.tone === 'string' ? b.tone : undefined,
    concept: typeof b.concept === 'string' ? b.concept : undefined,
  }
}

export function mergeOrchestrationEnvelopes(
  base: OrchestrationTokenEnvelope,
  patch: OrchestrationTokenEnvelope,
): OrchestrationTokenEnvelope {
  return {
    brand: { ...base.brand, ...patch.brand },
    tokens: {
      ...base.tokens,
      ...patch.tokens,
      colors: { ...base.tokens?.colors, ...patch.tokens?.colors },
      typography: { ...base.tokens?.typography, ...patch.tokens?.typography },
      ui: { ...base.tokens?.ui, ...patch.tokens?.ui },
    },
  }
}

export function envelopeToTokensJson(envelope: OrchestrationTokenEnvelope): string {
  return JSON.stringify(envelope, null, 2)
}

export function parseTokensJsonEnvelope(text: string): OrchestrationTokenEnvelope {
  try {
    const parsed = JSON.parse(text) as unknown
    return parseOrchestrationEnvelope(parsed)
  } catch {
    return {}
  }
}

/** Convierte respuesta del agente (JSON parcial o completo) en envelope mergeable. */
function parseJsonFromModelText(text: string): unknown | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const tryParse = (raw: string): unknown | null => {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }

  const direct = tryParse(trimmed)
  if (direct !== null) return direct

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch?.[1]) {
    const fromFence = tryParse(fenceMatch[1].trim())
    if (fromFence !== null) return fromFence
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return tryParse(trimmed.slice(firstBrace, lastBrace + 1))
  }

  return null
}

export function orchestrationEnvelopeHasContent(
  envelope: OrchestrationTokenEnvelope,
): boolean {
  if (envelope.brand?.concept?.trim() || envelope.brand?.tone?.trim()) return true
  if (envelope.tokens?.colors && Object.keys(envelope.tokens.colors).length > 0) return true
  if (envelope.tokens?.typography && Object.keys(envelope.tokens.typography).length > 0) {
    return true
  }
  if (envelope.tokens?.ui && Object.keys(envelope.tokens.ui).length > 0) return true
  return false
}

/** Convierte respuesta del agente (JSON parcial o completo) en envelope mergeable. */
export function envelopeFromModelJson(text: string): OrchestrationTokenEnvelope {
  const parsed = parseJsonFromModelText(text)
  if (parsed === null) return {}
  return parseOrchestrationEnvelope(parsed)
}

export function normalizeOrchestrationTokens(
  raw: unknown,
  existing?: DesignTokens,
): DesignTokens {
  const envelope = parseOrchestrationEnvelope(raw)
  return specTokensFromEnvelope(envelope, existing)
}

/** Tokens canónicos para spec/design.json y applyThemeToHtml. */
export function specTokensFromEnvelope(
  envelope: OrchestrationTokenEnvelope,
  existing?: DesignTokens,
): DesignTokens {
  const colors = { ...existing?.colors, ...envelope.tokens?.colors }
  if (colors.accent && !colors.tertiary) {
    colors.tertiary = colors.accent
  }
  delete colors.accent

  const typo = envelope.tokens?.typography
  const ui = envelope.tokens?.ui
  const labelFont = typo?.label?.trim() || typo?.body?.trim()

  const merged: DesignTokens = {
    ...existing,
    colors,
    fonts: {
      ...existing?.fonts,
      ...(typo?.heading ? { heading: wrapFontStack(typo.heading) } : {}),
      ...(typo?.body ? { body: wrapFontStack(typo.body) } : {}),
      ...(labelFont ? { label: wrapFontStack(labelFont) } : {}),
    },
    radius: ui?.borderRadius ?? existing?.radius,
    spacing: ui?.spacingUnit ?? existing?.spacing,
  }

  return ensureDesignTokens(merged)
}

function wrapFontStack(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'system-ui, sans-serif'
  if (trimmed.includes(',')) return trimmed
  return `"${trimmed}", system-ui, sans-serif`
}

export function brandTitleFromEnvelope(envelope: OrchestrationTokenEnvelope): string {
  return envelope.brand?.concept?.trim() || 'Diseño'
}

export function brandToneFromEnvelope(envelope: OrchestrationTokenEnvelope): string {
  return envelope.brand?.tone?.trim() || 'Generado con orquestación modular.'
}

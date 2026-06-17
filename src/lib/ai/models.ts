import { DEFAULT_GEMINI_MODEL } from '@/lib/ai/config'
import { DEFAULT_IMAGE_GEN_MODEL } from '@/lib/ai/constants'
import { vertexTextProactiveFallbackModelId } from '@/lib/ai/constants'
import { resolveVertexAgentTextModelId } from '@/lib/ai/vertexModelAllowlist'
import {
  CHAT_MODEL_IDS,
  MODEL_CATALOG,
  type CatalogModel,
} from '@/lib/ai/catalog'

import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/modelTypes'
import { resolveOrchestratorImplementModel } from '@/lib/ai/spec-kit/orchestrator'

export {
  AUTO_MODEL_ID,
  MAX_MODEL_ID,
  type AIModelOption,
  type AIModelProvider,
} from '@/lib/ai/modelTypes'

export type ThinkingLevel = 'minimal' | 'medium' | 'high'

export const THINKING_LEVELS: { id: ThinkingLevel; labelKey: string; rank: number }[] = [
  { id: 'minimal', labelKey: 'ed.thinkingMinimal', rank: 1 },
  { id: 'medium', labelKey: 'ed.thinkingMedium', rank: 2 },
  { id: 'high', labelKey: 'ed.thinkingHigh', rank: 3 },
]

export const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'medium'

/** Modelos del selector de chat (catálogo filtrado). */
export const AI_MODEL_OPTIONS = MODEL_CATALOG.filter((m) =>
  CHAT_MODEL_IDS.has(m.id),
)
  .sort((a, b) => a.latencyRank - b.latencyRank)
  .map(({ category: _c, vendor: _v, contextWindow: _w, pricing: _p, status: _s, ...rest }) => rest)

function findOption(modelId: string): CatalogModel | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId)
}

/** Retorna el modelo de generación de imágenes para un modelo de texto dado. */
export function getImageGenModelFor(modelId: string): string {
  return findOption(modelId)?.imageGenModel ?? DEFAULT_IMAGE_GEN_MODEL
}

export function modelSupportsThinking(modelId: string): boolean {
  if (modelId === AUTO_MODEL_ID || modelId === MAX_MODEL_ID) return false
  return findOption(modelId)?.supportsThinking ?? false
}

export function modelSupportsCaching(modelId: string): boolean {
  if (modelId === AUTO_MODEL_ID || modelId === MAX_MODEL_ID) return false
  return findOption(modelId)?.supportsCaching ?? false
}

const MOCK_MODEL_ID = 'mock-demo'

const ORCHESTRATABLE_IDS = new Set(
  MODEL_CATALOG.filter(
    (m) =>
      m.enabled &&
      m.category === 'text' &&
      m.id !== AUTO_MODEL_ID &&
      m.id !== MAX_MODEL_ID,
  ).map((m) => m.id),
)

export function isOrchestrableModelId(modelId: string): boolean {
  return ORCHESTRATABLE_IDS.has(modelId)
}

function enabledTextModels(): CatalogModel[] {
  return MODEL_CATALOG.filter(
    (m) =>
      m.id !== AUTO_MODEL_ID &&
      m.id !== MAX_MODEL_ID &&
      m.enabled &&
      m.category === 'text',
  )
}

const LEGACY_MODEL_ALIASES: Record<string, string> = {
  'claude-opus-4-7@anthropic': 'claude-opus-4-7',
  'claude-sonnet-4-6@anthropic': 'claude-sonnet-4-6',
  'claude-haiku-4-5@anthropic': 'claude-haiku-4-5',
  'deepseek-v3.2-maas': 'deepseek-ai/deepseek-v3.2-maas',
  'gemini-2.0-flash-001': 'google/gemini-2.0-flash-001',
}

function normalizeModelChoice(choice: string): string {
  return LEGACY_MODEL_ALIASES[choice] ?? choice
}

export function resolveModelId(
  choice: string | undefined | null,
  opts: { geminiEnabled: boolean },
): string {
  if (!opts.geminiEnabled) return MOCK_MODEL_ID

  const normalized = (choice?.trim() || AUTO_MODEL_ID).toLowerCase()

  if (normalized === AUTO_MODEL_ID) {
    const byLatency = [...enabledTextModels()].sort((a, b) => a.latencyRank - b.latencyRank)
    return byLatency[0]?.id ?? DEFAULT_GEMINI_MODEL
  }

  if (normalized === MAX_MODEL_ID) {
    return resolveOrchestratorImplementModel('', DEFAULT_GEMINI_MODEL)
  }

  const resolved = normalizeModelChoice(normalized)
  const legacyUpgrade = vertexTextProactiveFallbackModelId(resolved)
  const candidate =
    legacyUpgrade && findOption(legacyUpgrade)?.enabled ? legacyUpgrade : resolved
  const match = findOption(candidate)
  if (match && match.id !== AUTO_MODEL_ID && match.id !== MAX_MODEL_ID && match.enabled) {
    return match.id
  }

  const fallback = [...enabledTextModels()].sort((a, b) => a.latencyRank - b.latencyRank)[0]
  return resolveVertexAgentTextModelId(fallback?.id, DEFAULT_GEMINI_MODEL)
}

export function listModelsForClient(geminiEnabled: boolean) {
  return MODEL_CATALOG.filter(
    (m) => CHAT_MODEL_IDS.has(m.id) && (m.status === 'ga' || m.status === 'preview'),
  )
    .sort((a, b) => a.latencyRank - b.latencyRank)
    .map((m) => ({
    id: m.id,
    labelKey: m.labelKey,
    provider: m.provider,
    enabled:
      m.id === AUTO_MODEL_ID || m.id === MAX_MODEL_ID
        ? geminiEnabled
        : m.enabled && geminiEnabled,
    latencyRank: m.latencyRank,
    tier: m.tier,
    category: m.category,
    vendor: m.vendor,
    contextWindow: m.contextWindow,
    pricing: m.pricing,
    supportsThinking: m.supportsThinking,
    freeTier: m.pricing.freeTier ?? false,
  }))
}

export function isValidModelChoice(choice: string): boolean {
  const normalized = normalizeModelChoice(choice)
  return CHAT_MODEL_IDS.has(choice) || CHAT_MODEL_IDS.has(normalized)
}

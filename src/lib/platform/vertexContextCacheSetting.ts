export const VERTEX_CONTEXT_CACHE_SETTING_KEY = 'vertex_context_cache'

export type VertexContextCacheSetting = {
  enabled: boolean
  minTokens: number
}

const DEFAULT_MIN_TOKENS = 4096

export const DEFAULT_VERTEX_CONTEXT_CACHE_SETTING: VertexContextCacheSetting = {
  enabled: true,
  minTokens: DEFAULT_MIN_TOKENS,
}

function parseMinTokens(value: unknown): number {
  if (typeof value !== 'number') return DEFAULT_MIN_TOKENS
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MIN_TOKENS
  return Math.max(1, Math.floor(value))
}

function parseEnabledFlag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return undefined
}

function normalizeSettingValue(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return value
    }
  }
  return value
}

export function parseVertexContextCacheSetting(value: unknown): VertexContextCacheSetting {
  const raw = normalizeSettingValue(value)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_VERTEX_CONTEXT_CACHE_SETTING }
  }
  const input = raw as Partial<VertexContextCacheSetting>
  const enabled = parseEnabledFlag(input.enabled)
  return {
    enabled: enabled ?? DEFAULT_VERTEX_CONTEXT_CACHE_SETTING.enabled,
    minTokens: parseMinTokens(input.minTokens),
  }
}

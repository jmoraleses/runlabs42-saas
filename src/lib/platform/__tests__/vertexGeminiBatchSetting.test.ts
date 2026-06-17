import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VERTEX_GEMINI_BATCH_SETTING,
  parseVertexGeminiBatchEnabled,
} from '@/lib/platform/vertexGeminiBatchSetting'

describe('parseVertexGeminiBatchEnabled', () => {
  it('defaults to disabled when value missing (Vertex Batch requiere GCS)', () => {
    expect(DEFAULT_VERTEX_GEMINI_BATCH_SETTING.enabled).toBe(false)
    expect(parseVertexGeminiBatchEnabled(undefined)).toBe(false)
    expect(parseVertexGeminiBatchEnabled(null)).toBe(false)
  })

  it('reads enabled flag from stored object', () => {
    expect(parseVertexGeminiBatchEnabled({ enabled: true })).toBe(true)
    expect(parseVertexGeminiBatchEnabled({ enabled: false })).toBe(false)
  })
})

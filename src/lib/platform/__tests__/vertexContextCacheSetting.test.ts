import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VERTEX_CONTEXT_CACHE_SETTING,
  parseVertexContextCacheSetting,
} from '@/lib/platform/vertexContextCacheSetting'

describe('parseVertexContextCacheSetting', () => {
  it('usa defaults cuando no hay valor', () => {
    expect(parseVertexContextCacheSetting(undefined)).toEqual(
      DEFAULT_VERTEX_CONTEXT_CACHE_SETTING,
    )
    expect(parseVertexContextCacheSetting(null)).toEqual(
      DEFAULT_VERTEX_CONTEXT_CACHE_SETTING,
    )
  })

  it('parsea enabled y minTokens válidos', () => {
    expect(parseVertexContextCacheSetting({ enabled: false, minTokens: 8192 })).toEqual({
      enabled: false,
      minTokens: 8192,
    })
  })

  it('acepta enabled como string o JSON serializado', () => {
    expect(parseVertexContextCacheSetting({ enabled: 'false', minTokens: 4096 })).toEqual({
      enabled: false,
      minTokens: 4096,
    })
    expect(
      parseVertexContextCacheSetting('{"enabled":false,"minTokens":8192}'),
    ).toEqual({
      enabled: false,
      minTokens: 8192,
    })
  })

  it('normaliza minTokens inválido al default', () => {
    expect(parseVertexContextCacheSetting({ enabled: true, minTokens: -1 })).toEqual({
      enabled: true,
      minTokens: DEFAULT_VERTEX_CONTEXT_CACHE_SETTING.minTokens,
    })
    expect(parseVertexContextCacheSetting({ enabled: true, minTokens: Number.NaN })).toEqual({
      enabled: true,
      minTokens: DEFAULT_VERTEX_CONTEXT_CACHE_SETTING.minTokens,
    })
  })
})

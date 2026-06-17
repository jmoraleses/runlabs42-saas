import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getVertexContextCacheSetting = vi.fn<
  [],
  Promise<{ enabled: boolean; minTokens: number }>
>()

vi.mock('@/lib/platform/vertexContextCacheSetting.server', () => ({
  getVertexContextCacheSetting,
}))

vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    getClient = async () => ({
      getAccessToken: async () => ({ token: 'test-token' }),
    })
  },
}))

describe('geminiCache.getOrCreateCache', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('omite caché cuando la setting está deshabilitada', async () => {
    getVertexContextCacheSetting.mockResolvedValue({ enabled: false, minTokens: 1 })
    const { getOrCreateCache } = await import('@/lib/ai/geminiCache')

    const out = await getOrCreateCache({
      modelId: 'gemini-2.5-flash',
      systemInstruction: 'sys',
      staticContent: 'contenido',
      credentials: {
        projectId: 'p',
        location: 'us-central1',
        clientEmail: 'x@example.com',
        privateKey: 'pk',
      },
    })

    expect(out).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('omite caché si no llega al umbral mínimo de tokens', async () => {
    getVertexContextCacheSetting.mockResolvedValue({ enabled: true, minTokens: 9999 })
    const { getOrCreateCache } = await import('@/lib/ai/geminiCache')

    const out = await getOrCreateCache({
      modelId: 'gemini-2.5-flash',
      systemInstruction: 'sys',
      staticContent: 'corto',
      credentials: {
        projectId: 'p',
        location: 'us-central1',
        clientEmail: 'x@example.com',
        privateKey: 'pk',
      },
    })

    expect(out).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('crea y reutiliza cachedContent cuando está habilitado', async () => {
    getVertexContextCacheSetting.mockResolvedValue({ enabled: true, minTokens: 1 })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'cachedContents/test-123' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { getOrCreateCache } = await import('@/lib/ai/geminiCache')
    const params = {
      modelId: 'gemini-2.5-flash',
      systemInstruction: 'system-base',
      staticContent: 'workspace-content-1',
      credentials: {
        projectId: 'p',
        location: 'us-central1',
        clientEmail: 'x@example.com',
        privateKey: 'pk',
      },
    } as const

    const first = await getOrCreateCache(params)
    const second = await getOrCreateCache(params)

    expect(first).toBe('cachedContents/test-123')
    expect(second).toBe('cachedContents/test-123')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

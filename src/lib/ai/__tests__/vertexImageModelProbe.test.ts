import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/ai/config.server', () => ({
  isVertexAIConfigured: vi.fn(() => true),
}))

vi.mock('@/lib/ai/vertexAgentPlatform', () => ({
  generateImagen4Image: vi.fn(),
  generateAgentPlatformImage: vi.fn(),
}))

import {
  generateAgentPlatformImage,
  generateImagen4Image,
} from '@/lib/ai/vertexAgentPlatform'
import {
  getProbedVertexImageModelIds,
  invalidateVertexImageModelProbeCache,
  markVertexImageModelFailed,
  probeVertexImageModel,
} from '@/lib/ai/vertexImageModelProbe'

describe('vertexImageModelProbe', () => {
  beforeEach(() => {
    invalidateVertexImageModelProbeCache()
    vi.mocked(generateImagen4Image).mockReset()
    vi.mocked(generateAgentPlatformImage).mockReset()
  })

  it('sonda Imagen 3 por defecto sin llamar a Nano Banana', async () => {
    vi.mocked(generateImagen4Image).mockResolvedValue({
      data: 'abc',
      mimeType: 'image/png',
    })

    const ids = await getProbedVertexImageModelIds(['imagen-3.0-fast-generate-001'])

    expect(ids).toContain('imagen-3.0-fast-generate-001')
    expect(generateAgentPlatformImage).not.toHaveBeenCalled()
  })

  it('usa Nano Banana solo si Imagen 3 no responde', async () => {
    vi.mocked(generateImagen4Image).mockRejectedValue(Object.assign(new Error('503'), { status: 503 }))
    vi.mocked(generateAgentPlatformImage).mockResolvedValue({
      data: 'nb',
      mimeType: 'image/png',
    })

    const ids = await getProbedVertexImageModelIds(['imagen-3.0-fast-generate-001'])

    expect(ids).toContain('gemini-2.5-flash-image')
    expect(generateAgentPlatformImage).toHaveBeenCalled()
  })

  it('usa caché tras marcar fallido', async () => {
    vi.mocked(generateImagen4Image).mockResolvedValue({
      data: 'x',
      mimeType: 'image/png',
    })
    await probeVertexImageModel('imagen-3.0-fast-generate-001')
    markVertexImageModelFailed('imagen-3.0-fast-generate-001', 429)

    const ok = await probeVertexImageModel('imagen-3.0-fast-generate-001')
    expect(ok).toBe(false)
    expect(generateImagen4Image).toHaveBeenCalledTimes(1)
  })
})

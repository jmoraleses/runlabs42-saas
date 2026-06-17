import { describe, expect, it } from 'vitest'
import {
  AUTO_TOPIC_MAX_SCREENS_LIMIT,
  buildStitchScopeBlock,
  clampTopicMaxScreens,
  enrichTopicPromptForStitch,
  stripStitchScope,
} from '@/lib/auto/topicStitchPrompt'

describe('topicStitchPrompt', () => {
  it('añade bloque de alcance con pantallas y tipo web', () => {
    const out = enrichTopicPromptForStitch({
      prompt: 'Diseña una tienda minimalista de cosmética natural.',
      maxScreens: 8,
      designType: 'web',
    })
    expect(out).toContain('Diseña una tienda minimalista')
    expect(out).toContain('[Alcance Stitch:')
    expect(out).toContain('exactamente 8 pantallas')
    expect(out).toContain('sitio web responsive')
  })

  it('reemplaza alcance previo al cambiar tipo o pantallas', () => {
    const first = enrichTopicPromptForStitch({
      prompt: 'Blog de viajes.',
      maxScreens: 6,
      designType: 'web',
    })
    const second = enrichTopicPromptForStitch({
      prompt: first,
      maxScreens: 4,
      designType: 'app',
    })
    expect(stripStitchScope(second)).toBe('Blog de viajes.')
    expect(second).toContain('exactamente 4 pantallas')
    expect(second).toContain('aplicación móvil nativa')
    expect(second.match(/\[Alcance Stitch:/g)?.length).toBe(1)
  })

  it('buildStitchScopeBlock usa una pantalla en singular', () => {
    expect(buildStitchScopeBlock({ maxScreens: 1, designType: 'web' })).toContain(
      'una sola pantalla',
    )
  })

  it('clampTopicMaxScreens respeta el máximo de 16', () => {
    expect(AUTO_TOPIC_MAX_SCREENS_LIMIT).toBe(16)
    expect(clampTopicMaxScreens(20)).toBe(16)
    expect(clampTopicMaxScreens(16)).toBe(16)
  })
})

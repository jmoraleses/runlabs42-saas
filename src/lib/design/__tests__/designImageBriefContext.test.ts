import { describe, expect, it } from 'vitest'
import {
  briefImageSubjectContext,
  designBriefImageInstructionsBlock,
  enrichDesignImagePrompt,
} from '@/lib/design/designImageBriefContext'

describe('designImageBriefContext', () => {
  it('enrichDesignImagePrompt añade contexto del brief a prompts genéricos', () => {
    const brief = { prompt: 'Tienda de pollitos orgánicos', brandTone: 'cálido', siteType: 'ecommerce' as const }
    const out = enrichDesignImagePrompt(
      'Professional wide hero banner photograph for a modern website',
      brief,
    )
    expect(out).toContain('pollitos')
    expect(out.toLowerCase()).toContain('website subject')
  })

})

describe('designBriefImageInstructionsBlock', () => {
  it('vacío si generateImages desactivado', () => {
    expect(designBriefImageInstructionsBlock({ prompt: 'x' }, false)).toBe('')
  })

  it('incluye el prompt del usuario', () => {
    const block = designBriefImageInstructionsBlock({ prompt: 'App de yoga' }, true)
    expect(block).toContain('App de yoga')
    expect(block).toContain('[IMAGE:')
  })
})

describe('briefImageSubjectContext', () => {
  it('concatena prompt, tono y tipo', () => {
    expect(
      briefImageSubjectContext({
        prompt: 'Pollitos',
        brandTone: 'orgánico',
        siteType: 'ecommerce',
      }),
    ).toContain('Pollitos')
    expect(briefImageSubjectContext({ prompt: 'Pollitos' })).toContain('Pollitos')
  })
})

import { describe, expect, it } from 'vitest'
import {
  rebuildPageModifyHtmlBlock,
  userPromptRequestsImageChanges,
} from '@/lib/design/designModifyPrompts'

describe('designModifyPrompts', () => {
  it('detects explicit image change requests', () => {
    expect(userPromptRequestsImageChanges('cambia el hero por otra foto')).toBe(true)
    expect(userPromptRequestsImageChanges('añade una imagen en el banner')).toBe(true)
    expect(userPromptRequestsImageChanges('[IMAGE: assets/hero.jpg | sunset | 16:9]')).toBe(true)
  })

  it('does not treat copy-only edits as image requests', () => {
    expect(userPromptRequestsImageChanges('cambia el título a Ofertas')).toBe(false)
    expect(userPromptRequestsImageChanges('solo texto: actualiza el párrafo del hero')).toBe(false)
    expect(userPromptRequestsImageChanges('haz el botón más grande')).toBe(false)
  })

  it('rebuild block asks to preserve existing img tags when not changing photos', () => {
    const html =
      '<!DOCTYPE html><html><body><img src="assets/hero.jpg" data-sk-id="hero" class="object-cover"></body></html>'
    const block = rebuildPageModifyHtmlBlock('home', html, 'cambia el título', {
      generateImages: false,
    })
    expect(block).toContain('CONSERVAR FOTOS EXISTENTES')
    expect(block).toContain('assets/hero.jpg')
    expect(block).toContain(html)
  })
})

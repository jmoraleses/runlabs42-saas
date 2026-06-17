import { describe, expect, it } from 'vitest'
import { buildCanvasPinsPromptSuffix } from '@/lib/visual-edit/canvasPins'

describe('buildCanvasPinsPromptSuffix', () => {
  it('builds instructions for each pin', () => {
    const suffix = buildCanvasPinsPromptSuffix([
      {
        id: 'p1',
        label: 'area1',
        kind: 'area',
        pageId: 'home',
        pageName: 'Inicio',
        xPercent: 42.5,
        yPercent: 60,
        widthPercent: 30,
        heightPercent: 18,
        description: 'Añadir un vídeo de demostración',
        elementSkId: 'sk-2',
        elementTag: 'section',
      },
    ])
    expect(suffix).toContain('area1')
    expect(suffix).toContain('42.5% horizontal')
    expect(suffix).toContain('30.0% de ancho')
    expect(suffix).toContain('18.0% de alto')
    expect(suffix).toContain('vídeo de demostración')
    expect(suffix).toContain('sk-2')
  })

  it('returns empty for no pins', () => {
    expect(buildCanvasPinsPromptSuffix([])).toBe('')
  })
})

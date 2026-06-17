import { describe, expect, it, vi } from 'vitest'
import { htmlVisualReviewSystemInstruction } from '@/lib/design/orchestrationPrompts'
import { runPageHtmlVisualReview } from '@/lib/design/orchestrationHtmlReview'

vi.mock('@/lib/design/captureDesignPageReviewScreenshot.server', () => ({
  captureDesignPageReviewScreenshot: vi.fn(async () => null),
}))

const ACCEPTABLE_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>${':root{--primary:#2d5016} '.repeat(120)}</style></head><body><main><h1>Título de la página con contenido visible</h1><p>${'Texto editorial denso y específico del producto. '.repeat(40)}</p></main></body></html>`

describe('runPageHtmlVisualReview', () => {
  it('no hace nada si DESIGN_HTML_REVIEW=0', async () => {
    vi.stubEnv('DESIGN_HTML_REVIEW', '0')
    const out = await runPageHtmlVisualReview({
      page: { id: 'home', name: 'Inicio' },
      brief: { prompt: 'Tienda' },
      device: 'desktop',
      html: ACCEPTABLE_HTML,
      extraPromptBlocks: [],
      modelId: 'test',
      callText: async () => 'no debería llamarse',
    })
    expect(out).toBe(ACCEPTABLE_HTML)
  })

  it('devuelve el HTML original si la revisión no es aceptable', async () => {
    vi.stubEnv('DESIGN_HTML_REVIEW', '1')
    const out = await runPageHtmlVisualReview({
      page: { id: 'home', name: 'Inicio' },
      brief: { prompt: 'Tienda' },
      device: 'desktop',
      html: ACCEPTABLE_HTML,
      extraPromptBlocks: [],
      modelId: 'test',
      callText: async () => 'basura corta',
    })
    expect(out).toBe(ACCEPTABLE_HTML)
  })

  it('acepta HTML revisado válido del modelo', async () => {
    vi.stubEnv('DESIGN_HTML_REVIEW', '1')
    const reviewed = ACCEPTABLE_HTML.replace(
      '</head>',
      '<meta name="reviewed" content="1"></head>',
    )
    const out = await runPageHtmlVisualReview({
      page: { id: 'home', name: 'Inicio' },
      brief: { prompt: 'Tienda' },
      device: 'desktop',
      html: ACCEPTABLE_HTML,
      extraPromptBlocks: [],
      modelId: 'test',
      callText: async () => `\`\`\`html design/pages/home/index.html\n${reviewed}\n\`\`\``,
    })
    expect(out).toContain('reviewed')
  })
})

describe('htmlVisualReviewSystemInstruction', () => {
  it('identifica el agente de revisión HTML', () => {
    expect(htmlVisualReviewSystemInstruction()).toContain('AGENTE DE REVISIÓN DE HTML')
  })

  it('menciona screenshot cuando hay captura', () => {
    expect(htmlVisualReviewSystemInstruction('desktop', true)).toContain('screenshot')
  })
})

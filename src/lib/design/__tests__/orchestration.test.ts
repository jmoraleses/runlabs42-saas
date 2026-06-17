import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/platform/designImageGenerationSetting.server', () => ({
  isDesignImageGenerationEnabled: vi.fn(async () => true),
}))

vi.mock('@/lib/design/designImageGenAvailability.server', () => ({
  getDesignImageGenBlockReason: vi.fn(async () => null),
  shouldRunDesignImageGen: vi.fn(async (requested?: boolean) => Boolean(requested)),
}))

vi.mock('@/lib/design/agentStudio/config.server', () => ({
  isDesignAgentStudioEnabled: vi.fn(async () => false),
  getDesignAgentStudioEngineResource: vi.fn(async () => null),
}))

const generateAgentPlatformText = vi.fn()
const streamAgentPlatformText = vi.fn()
const generateDesignImagesFromOutput = vi.fn()
const executeOrchestrationAssetPlan = vi.fn()

vi.mock('@/lib/ai/vertexAgentPlatform', () => ({
  generateAgentPlatformText: (...args: unknown[]) => generateAgentPlatformText(...args),
  streamAgentPlatformText: (...args: unknown[]) => streamAgentPlatformText(...args),
}))

vi.mock('@/lib/design/designImageGen', () => ({
  isDesignImageGenAvailable: vi.fn(async () => true),
  generateDesignImagesFromOutput: (...args: unknown[]) => generateDesignImagesFromOutput(...args),
  mergeDesignFilesWithImages: (
    files: Array<{ path: string; content: string }>,
    images: Array<{ path: string; content: string }>,
  ) => [...files, ...images],
  stripImageTags: (html: string) => html,
  stripImageTagsFromDesignFiles: (files: Array<{ path: string; content: string }>) => files,
}))

vi.mock('@/lib/design/captureDesignPageReviewScreenshot.server', () => ({
  captureDesignPageReviewScreenshot: vi.fn(async () => null),
}))

vi.mock('@/lib/design/orchestrationAssets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/design/orchestrationAssets')>()
  return {
    ...actual,
    executeOrchestrationAssetPlan: (...args: unknown[]) => executeOrchestrationAssetPlan(...args),
  }
})

import { generateOrchestratedDesign, regenerateOrchestrationFromTokens } from '@/lib/design/orchestration'
import { DESIGN_LAYOUT_PATH, DESIGN_TOKENS_PATH } from '@/lib/design/orchestrationParse'
import { DESIGN_SPEC_JSON, DESIGN_SPEC_MD } from '@/lib/design/types'
import { pageHtmlPath } from '@/lib/design/pages'
import {
  MOCK_ASSET_PLAN_EMPTY,
  MOCK_ASSET_PLAN_HERO,
  MOCK_LAYOUT_CLASSIC,
  MOCK_LAYOUT_VALID,
  MOCK_PALETTE_ONLY,
  MOCK_TOKENS,
  MOCK_TYPOGRAPHY_UI,
  MOCK_ASSET_PLAN_HERO,
  MOCK_DESIGN_MD,
  mockDesignMdResponse,
  mockDesignMdStepResponse,
  mockHtmlPartResponse,
  mockOrchestrationHtml,
  pageIdFromContentPrompt,
  systemInstructionKind,
} from './fixtures/orchestrationMocks'

describe('generateOrchestratedDesign', () => {
  let layoutCallCount = 0
  /** 'valid' = layout no plantilla en la 1ª llamada; 'classic-then-valid' = prueba reintento */
  let layoutMockMode: 'valid' | 'classic-then-valid' | 'empty' = 'valid'

  beforeEach(() => {
    vi.stubEnv('DESIGN_HTML_REVIEW', '1')
    layoutCallCount = 0
    layoutMockMode = 'valid'
    generateAgentPlatformText.mockReset()
    streamAgentPlatformText.mockReset()
    generateDesignImagesFromOutput.mockReset()
    executeOrchestrationAssetPlan.mockReset()

    generateDesignImagesFromOutput.mockResolvedValue([])
    executeOrchestrationAssetPlan.mockResolvedValue([
      {
        path: 'design/site/assets/hero.jpg',
        content: 'base64hero',
        mimeType: 'image/jpeg',
      },
    ])

    generateAgentPlatformText.mockImplementation(async (prompt: string, opts) => {
      if (
        opts?.images?.length &&
        opts?.responseMimeType === 'application/json' &&
        String(opts?.systemInstruction ?? '').includes('auditor visual')
      ) {
        return JSON.stringify({
          siteType: 'ecommerce',
          layoutTopology: 'ecommerce-catalog',
          brandName: 'RefBrand',
          sectionTypes: ['site-header', 'catalog-sidebar', 'product-grid'],
          dominantColors: ['#3E5641', '#E67E5F'],
          locale: 'es',
        })
      }
      const kind = systemInstructionKind(opts?.systemInstruction ?? '')
      if (kind === 'design-md-step') return mockDesignMdStepResponse(prompt)
      if (kind === 'html-part') return mockHtmlPartResponse(prompt)
      if (kind === 'design-md') return mockDesignMdResponse()
      if (kind === 'palette') return JSON.stringify(MOCK_PALETTE_ONLY)
      if (kind === 'typography') return JSON.stringify(MOCK_TYPOGRAPHY_UI)
      if (kind === 'tokens-review') return JSON.stringify(MOCK_TOKENS)
      if (kind === 'tokens') return JSON.stringify(MOCK_TOKENS)
      if (kind === 'layout') {
        layoutCallCount += 1
        if (layoutMockMode === 'empty') return '{}'
        const useClassicFirst =
          layoutMockMode === 'classic-then-valid' && layoutCallCount === 1
        const payload = useClassicFirst ? MOCK_LAYOUT_CLASSIC : MOCK_LAYOUT_VALID
        return JSON.stringify(payload)
      }
      if (kind === 'assets') return JSON.stringify(MOCK_ASSET_PLAN_HERO)
      if (kind === 'content') {
        const pageId = pageIdFromContentPrompt(prompt)
        return mockOrchestrationHtml(pageId)
      }
      if (kind === 'html-review') {
        const pageId = pageIdFromContentPrompt(prompt)
        const base = mockOrchestrationHtml(pageId)
        return base.replace('</head>', '<meta name="reviewed" content="1"></head>')
      }
      throw new Error(`Unexpected orchestration call: ${kind}`)
    })

    streamAgentPlatformText.mockImplementation(async (opts) => {
      const text = await generateAgentPlatformText(opts.prompt, {
        systemInstruction: opts.systemInstruction,
        model: opts.modelId,
        images: opts.images,
      })
      opts.onToken(text)
      return { text, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }
    })
  })

  it('ejecuta las fases en orden y genera tokens, layout, HTML por pantalla y spec', async () => {
    const phases: string[] = []
    const partialBatches: string[][] = []

    const { files } = await generateOrchestratedDesign('Tienda online de cactus artesanales', {
      device: 'desktop',
      brief: {
        prompt: 'Tienda online de cactus artesanales',
        siteType: 'ecommerce',
        brandTone: 'orgánico premium',
      },
      send: (type, data) => {
        if (type === 'phase') phases.push(data)
      },
      persistPartial: async (batch) => {
        partialBatches.push(batch.map((f) => f.path))
      },
    })

    expect(phases[0]).toBe('design-system')
    expect(phases).not.toContain('tokens-review')
    expect(phases).not.toContain('palette-generation')
    expect(phases).not.toContain('typography-ui')
    expect(phases).toContain('layout')
    expect(phases).not.toContain('asset-planning')
    expect(phases).toContain('html')
    expect(phases).not.toContain('html-build:sequential-fallback')
    expect(phases).toContain('html-refine')

    const paths = files.map((f) => f.path)
    expect(paths).toContain(DESIGN_SPEC_MD)
    expect(paths).toContain(DESIGN_TOKENS_PATH)
    expect(paths).toContain(DESIGN_LAYOUT_PATH)
    expect(paths).toContain(DESIGN_SPEC_JSON)
    expect(paths).toContain(pageHtmlPath('home'))
    expect(paths).toContain(pageHtmlPath('pricing'))

    const homeFile = files.find((f) => f.path === pageHtmlPath('home'))
    expect(homeFile?.content).toContain('<!DOCTYPE html>')
    expect(homeFile?.content).toContain('data-sk-id')
    expect(homeFile?.content).toContain('Cactus Haven')

    const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content
    expect(specRaw).toBeTruthy()
    const spec = JSON.parse(specRaw!) as { pages?: Array<{ id: string }> }
    expect(spec.pages?.some((p) => p.id === 'home')).toBe(true)
    expect(spec.pages?.some((p) => p.id === 'pricing')).toBe(true)

    expect(layoutCallCount).toBe(1)

    const htmlGenCalls = generateAgentPlatformText.mock.calls.filter(([, opts]) => {
      const kind = systemInstructionKind(
        (opts as { systemInstruction?: string })?.systemInstruction ?? '',
      )
      return kind === 'content' || kind === 'html-part' || kind === 'html-review'
    })
    // Monolito Stitch: al menos una llamada content por pantalla (html-review vía callText interno).
    expect(htmlGenCalls.length).toBeGreaterThanOrEqual(2)
    expect(partialBatches.some((b) => b.includes(pageHtmlPath('home')))).toBe(true)
  })

  it('propaga imágenes de referencia a todas las llamadas de texto', async () => {
    const images = [{ mimeType: 'image/png', data: 'abc123' }]
    const phases: string[] = []

    await generateOrchestratedDesign('Web con referencia visual', {
      images,
      send: (type, data) => {
        if (type === 'phase') phases.push(data)
      },
    })

    expect(phases).toContain('design-system')

    for (const [, opts] of generateAgentPlatformText.mock.calls) {
      const kind = systemInstructionKind(
        (opts as { systemInstruction?: string })?.systemInstruction ?? '',
      )
      if (kind === 'html-review' || kind === 'assets') continue
      expect((opts as { images?: unknown[] })?.images).toEqual(images)
    }
  })

  it('usa streaming por pantalla cuando hay onToken', async () => {
    const tokens: string[] = []

    await generateOrchestratedDesign('Landing de cactus', {
      onToken: (chunk) => tokens.push(chunk),
    })

    expect(streamAgentPlatformText).not.toHaveBeenCalled()
    expect(tokens.join('')).toMatch(/<!DOCTYPE|data-sk-id/i)
  })

  it('persiste por lotes durante el pipeline', async () => {
    const partialBatches: string[][] = []

    await generateOrchestratedDesign('Catálogo de plantas', {
      persistPartial: async (batch) => {
        partialBatches.push(batch.map((f) => f.path))
      },
    })

    expect(partialBatches.length).toBeGreaterThanOrEqual(3)
    expect(partialBatches.some((batch) => batch.includes(DESIGN_TOKENS_PATH))).toBe(true)
    expect(partialBatches.some((batch) => batch.includes(DESIGN_LAYOUT_PATH))).toBe(true)
    expect(
      partialBatches.some((batch) => batch.some((p) => p.endsWith('.html'))),
    ).toBe(true)
  })

  it('no invoca generación de assets cuando generateImages está desactivado', async () => {
    await generateOrchestratedDesign('Web minimalista', {})

    expect(executeOrchestrationAssetPlan).not.toHaveBeenCalled()
    expect(generateDesignImagesFromOutput).not.toHaveBeenCalled()
  })

  it('genera imágenes al terminar cada pantalla cuando generateImages está activado', async () => {
    const phases: string[] = []

    await generateOrchestratedDesign('Web con imágenes', {
      generateImages: true,
      send: (type, data) => {
        if (type === 'phase') phases.push(data)
      },
    })

    expect(phases).not.toContain('asset-planning')
    expect(phases).not.toContain('images')
    expect(phases).not.toContain('asset-generation')
    const htmlIdx = phases.indexOf('html')
    const assetsIdx = phases.indexOf('assets')
    expect(htmlIdx).toBeGreaterThanOrEqual(0)
    expect(assetsIdx).toBeGreaterThan(htmlIdx)
    expect(executeOrchestrationAssetPlan).not.toHaveBeenCalled()
    expect(generateDesignImagesFromOutput).toHaveBeenCalled()
    const imageCall = generateDesignImagesFromOutput.mock.calls.find(
      (c) => (c[2] as { pageId?: string } | undefined)?.pageId,
    )
    expect(imageCall?.[2]).toMatchObject({ emitBatchPhase: false, pageId: expect.any(String) })
  })

  it('genera HTML de home aunque el layout del modelo esté vacío', async () => {
    layoutMockMode = 'empty'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { files } = await generateOrchestratedDesign('Web sin layout del modelo', {})

    expect(files.some((f) => f.path === pageHtmlPath('home'))).toBe(true)
    expect(warnSpy).not.toHaveBeenCalledWith(
      '[orchestration] Layout sin páginas del modelo; usando plantilla de respaldo',
    )
    warnSpy.mockRestore()
  })

  it('persiste main largo sin <html> ni cierre de fence (sin fallback)', async () => {
    const mainChunk =
      '<section class="block"><h2>Producto</h2><p>Descripción visual densa.</p></section>'.repeat(
        120,
      )
    const wrapped =
      'Aquí está la pantalla:\n\n```html design/site/index.html\n<main>' + mainChunk + '</main>'

    generateAgentPlatformText.mockImplementation(async (prompt: string, opts) => {
      const kind = systemInstructionKind(opts?.systemInstruction ?? '')
      if (kind === 'design-md-step') return mockDesignMdStepResponse(prompt)
      if (kind === 'html-part') return mockHtmlPartResponse(prompt)
      if (kind === 'design-md') return mockDesignMdResponse()
      if (kind === 'content') return wrapped
      if (kind === 'palette') return JSON.stringify(MOCK_PALETTE_ONLY)
      if (kind === 'typography') return JSON.stringify(MOCK_TYPOGRAPHY_UI)
      if (kind === 'tokens-review') return JSON.stringify(MOCK_TOKENS)
      if (kind === 'tokens') return JSON.stringify(MOCK_TOKENS)
      if (kind === 'layout') return JSON.stringify(MOCK_LAYOUT_VALID)
      if (kind === 'assets') return JSON.stringify(MOCK_ASSET_PLAN_EMPTY)
      if (kind === 'html-review') return wrapped
      throw new Error(`Unexpected orchestration call: ${kind}`)
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { files } = await generateOrchestratedDesign('Tienda sin html wrapper', { device: 'desktop' })
    const home = files.find((f) => f.path === pageHtmlPath('home'))
    expect(home?.content.length).toBeGreaterThan(6000)
    expect(home?.content).toMatch(/<body[\s>]/i)
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('HTML fallback para home'),
    )
    warnSpy.mockRestore()
  })

  it('persiste HTML largo del modelo (main denso) sin sustituir por fallback', async () => {
    const bigMainHtml =
      '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Tienda</title><style>' +
      '.card{display:grid;gap:1rem}'.repeat(350) +
      '</style></head><main><div class="grid">' +
      '<article class="card"><h2>Catálogo</h2><p>Detalle visual.</p></article>'.repeat(90) +
      '</div></main></html>'
    const wrapped = `\`\`\`html design/site/index.html\n${bigMainHtml}`

    generateAgentPlatformText.mockImplementation(async (prompt: string, opts) => {
      const kind = systemInstructionKind(opts?.systemInstruction ?? '')
      if (kind === 'design-md-step') return mockDesignMdStepResponse(prompt)
      if (kind === 'html-part') return mockHtmlPartResponse(prompt)
      if (kind === 'design-md') return mockDesignMdResponse()
      if (kind === 'content') return wrapped
      if (kind === 'palette') return JSON.stringify(MOCK_PALETTE_ONLY)
      if (kind === 'typography') return JSON.stringify(MOCK_TYPOGRAPHY_UI)
      if (kind === 'tokens-review') return JSON.stringify(MOCK_TOKENS)
      if (kind === 'tokens') return JSON.stringify(MOCK_TOKENS)
      if (kind === 'layout') return JSON.stringify(MOCK_LAYOUT_VALID)
      if (kind === 'assets') return JSON.stringify(MOCK_ASSET_PLAN_EMPTY)
      if (kind === 'html-review') return wrapped
      throw new Error(`Unexpected orchestration call: ${kind}`)
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { files } = await generateOrchestratedDesign('Tienda visual', { device: 'desktop' })
    const home = files.find((f) => f.path === pageHtmlPath('home'))
    expect(home?.content.length).toBeGreaterThan(6000)
    expect(home?.content).not.toContain('Vista generada automáticamente')
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('HTML fallback para home'),
    )
    warnSpy.mockRestore()
  })

  it('reintenta la fase de layout si el modelo devuelve plantilla clásica', async () => {
    layoutMockMode = 'classic-then-valid'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await generateOrchestratedDesign('Web con layout genérico inicial', {})

    expect(layoutCallCount).toBe(2)
    expect(warnSpy).toHaveBeenCalledWith(
      '[orchestration] Layout genérico, reintentando fase 2:',
      expect.stringContaining('navigation'),
    )

    warnSpy.mockRestore()
  })

  it('con forceNewPage no sobrescribe el HTML de pantallas existentes', async () => {
    const homeMarker = 'HOME_PRESERVED_MARKER_42'
    const existingHomeHtml = mockOrchestrationHtml('home').replace(
      'Cactus Haven',
      homeMarker,
    )
    const existing = [
      { path: DESIGN_SPEC_MD, content: MOCK_DESIGN_MD },
      { path: DESIGN_TOKENS_PATH, content: JSON.stringify(MOCK_TOKENS) },
      { path: pageHtmlPath('home'), content: existingHomeHtml },
    ]

    generateAgentPlatformText.mockImplementation(async (prompt: string, opts) => {
      const kind = systemInstructionKind(opts?.systemInstruction ?? '')
      if (kind === 'design-md-step') return mockDesignMdStepResponse(prompt)
      if (kind === 'html-part') return mockHtmlPartResponse(prompt)
      if (kind === 'design-md') return mockDesignMdResponse()
      if (kind === 'content') {
        const pageId = pageIdFromContentPrompt(prompt)
        if (pageId && pageId !== 'home') {
          return mockOrchestrationHtml('home')
        }
        return mockOrchestrationHtml(pageId ?? 'home')
      }
      if (kind === 'palette') return JSON.stringify(MOCK_PALETTE_ONLY)
      if (kind === 'typography') return JSON.stringify(MOCK_TYPOGRAPHY_UI)
      if (kind === 'tokens-review') return JSON.stringify(MOCK_TOKENS)
      if (kind === 'tokens') return JSON.stringify(MOCK_TOKENS)
      if (kind === 'layout') return JSON.stringify(MOCK_LAYOUT_VALID)
      if (kind === 'assets') return JSON.stringify(MOCK_ASSET_PLAN_EMPTY)
      if (kind === 'html-review') {
        const pageId = pageIdFromContentPrompt(prompt)
        return mockOrchestrationHtml(pageId)
      }
      throw new Error(`Unexpected orchestration call: ${kind}`)
    })

    const { files } = await generateOrchestratedDesign('Crea otra página de precios', {
      existing,
      forceNewPage: true,
    })

    const home = files.find((f) => f.path === pageHtmlPath('home'))
    expect(home?.content).toContain(homeMarker)
    const newPages = files.filter(
      (f) => f.path.endsWith('.html') && f.path !== pageHtmlPath('home'),
    )
    expect(newPages.length).toBeGreaterThan(0)
  })

  it('con replaceDesign no conserva design.md previo (regenera sistema visual)', async () => {
    const phases: string[] = []
    const existing = [
      { path: DESIGN_SPEC_MD, content: MOCK_DESIGN_MD },
      { path: DESIGN_TOKENS_PATH, content: JSON.stringify(MOCK_TOKENS) },
      { path: pageHtmlPath('home'), content: '<html>OLD_HOME</html>' },
    ]

    generateAgentPlatformText.mockImplementation(async (prompt: string, opts) => {
      const kind = systemInstructionKind(opts?.systemInstruction ?? '')
      if (kind === 'design-md-step') return mockDesignMdStepResponse(prompt)
      if (kind === 'html-part') return mockHtmlPartResponse(prompt)
      if (kind === 'design-md') return mockDesignMdResponse()
      if (kind === 'content') {
        const pageId = pageIdFromContentPrompt(prompt)
        return mockOrchestrationHtml(pageId ?? 'home')
      }
      if (kind === 'palette') return JSON.stringify(MOCK_PALETTE_ONLY)
      if (kind === 'typography') return JSON.stringify(MOCK_TYPOGRAPHY_UI)
      if (kind === 'tokens-review') return JSON.stringify(MOCK_TOKENS)
      if (kind === 'tokens') return JSON.stringify(MOCK_TOKENS)
      if (kind === 'layout') return JSON.stringify(MOCK_LAYOUT_VALID)
      if (kind === 'assets') return JSON.stringify(MOCK_ASSET_PLAN_EMPTY)
      if (kind === 'html-review') {
        const pageId = pageIdFromContentPrompt(prompt)
        return mockOrchestrationHtml(pageId)
      }
      throw new Error(`Unexpected orchestration call: ${kind}`)
    })

    await generateOrchestratedDesign('Tienda de zapatos nueva', {
      existing,
      replaceDesign: true,
      forceNewPage: false,
      send: (type, data) => {
        if (type === 'phase') phases.push(data)
      },
    })

    expect(phases).toContain('design-system')
  })

  it('regenera layout y HTML desde tokens existentes sin fases de paleta', async () => {
    const phases: string[] = []
    const tokensJson = JSON.stringify(MOCK_TOKENS)

    await regenerateOrchestrationFromTokens('Tienda de cactus', {
      device: 'desktop',
      tokensJson,
      send: (type, data) => {
        if (type === 'phase') phases.push(data)
      },
    })

    expect(phases).not.toContain('palette-generation')
    expect(phases).not.toContain('typography-ui')
    expect(phases).not.toContain('tokens-review')
    expect(phases[0]).toBe('layout-planning')
    expect(phases).toContain('content-generation')
  })
})

import 'server-only'

import { getMockupGenModelCandidates } from '@/lib/ai/config.server'
import { generateImagen4Images } from '@/lib/ai/vertexAgentPlatform'
import { DESIGN_BREAKPOINT_PRESETS } from '@/lib/design/breakpoints'
import {
  pageMockupPath,
  type DesignPageMeta,
  type DesignSpec,
} from '@/lib/design/types'
import { aspectRatioFromPageDimensions, isImagenModelId } from '@/lib/ai/constants'
import {
  MOCKUP_FULL_BLEED_RULES_EN,
  MOCKUP_NEGATIVE_PROMPT,
  MOCKUP_PROMPT_PREFIX,
  sanitizeImagePromptForMockup,
} from '@/lib/design/prompts'

import {
  clampMockupSampleCount,
  MOCKUP_GEN_DELAY_MS,
  MOCKUP_GEN_MAX_RETRIES,
} from '@/lib/design/mockupSampleCount'

export type GeneratedMockup = {
  path: string
  content: string
  mimeType: string
  pageId: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableVertexStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 500
}

function buildMockupPrompt(page: DesignPageMeta, spec: DesignSpec): string {
  const tokens = spec.tokens
  const colors = tokens?.colors
    ? Object.entries(tokens.colors)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : ''
  const fonts = tokens?.fonts
    ? `body: ${tokens.fonts.body ?? 'system-ui'}, heading: ${tokens.fonts.heading ?? 'system-ui'}`
    : ''
  const device = spec.targetDevice ?? 'desktop'
  const pageW = page.width ?? (device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1440)
  const pageH = page.height ?? (device === 'mobile' ? 844 : device === 'tablet' ? 1024 : 900)
  const base = sanitizeImagePromptForMockup(page.imagePrompt?.trim() ?? '')
  if (!base) {
    throw new Error(`Página "${page.id}" sin imagePrompt`)
  }
  const layoutHint =
    device === 'desktop'
      ? `Complete full-length desktop web page (${pageW}×${pageH}px): header through footer in one tall frame, edge-to-edge.`
      : device === 'tablet'
        ? `Complete full-length tablet web page (${pageW}×${pageH}px), all sections visible, edge-to-edge.`
        : `Complete full-length mobile web page (${pageW}×${pageH}px), scrollable screen, edge-to-edge.`
  return [
    MOCKUP_PROMPT_PREFIX,
    MOCKUP_FULL_BLEED_RULES_EN,
    'CRITICAL: The image IS the full web page UI (Figma artboard style). No browser window. No device photo. UI touches all four edges.',
    `Show the ENTIRE "${page.name}" page top to bottom — not a cropped banner or viewport slice.`,
    `High-fidelity flat web UI for "${page.name}" screen.`,
    layoutHint,
    `Product: ${spec.title}.`,
    base,
    colors ? `Color palette: ${colors}.` : '',
    fonts ? `Typography: ${fonts}.` : '',
    spec.summary ? `Context: ${spec.summary.slice(0, 400)}.` : '',
    'Sharp readable text, no watermark.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Asegura restricciones full-bleed en prompts sueltos (iterate/reimagine). */
export function augmentImagenMockupPrompt(base: string): string {
  const trimmed = sanitizeImagePromptForMockup(base.trim())
  return `${MOCKUP_PROMPT_PREFIX}${MOCKUP_FULL_BLEED_RULES_EN} ${trimmed}`
}

export function imagenMockupPredictOpts(
  aspect: string,
  modelId?: string,
  sampleCount = 1,
) {
  return {
    aspect,
    modelId,
    sampleCount: clampMockupSampleCount(sampleCount),
    negativePrompt: MOCKUP_NEGATIVE_PROMPT,
  }
}

async function generateMockupWithRetry(
  prompt: string,
  aspect: string,
  modelId?: string,
  sampleCount = 1,
): Promise<Array<{ data: string; mimeType: string }>> {
  let lastError: unknown
  const candidates = modelId ? [modelId] : getMockupGenModelCandidates()
  const count = clampMockupSampleCount(sampleCount)

  for (const candidate of candidates) {
    for (let attempt = 0; attempt < MOCKUP_GEN_MAX_RETRIES; attempt++) {
      try {
        const imgs = await generateImagen4Images(
          prompt,
          imagenMockupPredictOpts(aspect, candidate, count),
        )
        if (imgs.length) return imgs
      } catch (err) {
        lastError = err
        const status = (err as Error & { status?: number }).status
        if (status != null && isRetryableVertexStatus(status) && attempt < MOCKUP_GEN_MAX_RETRIES - 1) {
          const backoff = Math.min(12_000, 1500 * 2 ** attempt)
          console.warn(
            `[mockupGen] Imagen 4 ${status} (${candidate}), reintento ${attempt + 2}/${MOCKUP_GEN_MAX_RETRIES} en ${backoff}ms`,
          )
          await sleep(backoff)
          continue
        }
        console.warn(
          `[mockupGen] Imagen 4 falló con ${candidate}:`,
          err instanceof Error ? err.message : err,
        )
        break
      }
    }
  }

  if (lastError) throw lastError
  throw new Error('Imagen 4: no se generó mockup')
}

export async function generateMockupsFromSpec(
  spec: DesignSpec,
  pages: DesignPageMeta[],
  send?: (type: string, data: string) => void,
  opts?: {
    modelId?: string
    sampleCount?: number
    onPageMockups?: (mockups: GeneratedMockup[], page: DesignPageMeta) => void | Promise<void>
  },
): Promise<GeneratedMockup[]> {
  const { isDesignImageGenerationEnabled } = await import(
    '@/lib/platform/designImageGenerationSetting.server'
  )
  if (!(await isDesignImageGenerationEnabled())) {
    console.info('[mockupGen] Generación de imágenes desactivada (admin)')
    return []
  }

  const imagePages = pages.filter((p) => p.media !== 'html')
  if (!imagePages.length) return []

  const sampleCount = clampMockupSampleCount(opts?.sampleCount ?? 1)
  const imagenModel =
    opts?.modelId && isImagenModelId(opts.modelId) ? opts.modelId : undefined
  const results: GeneratedMockup[] = []

  for (let i = 0; i < imagePages.length; i++) {
    const page = imagePages[i]!
    const pageW = page.width ?? DESIGN_BREAKPOINT_PRESETS[spec.targetDevice ?? 'desktop'].width
    const pageH = page.height ?? DESIGN_BREAKPOINT_PRESETS[spec.targetDevice ?? 'desktop'].height
    const aspect = aspectRatioFromPageDimensions(pageW, pageH, page.aspectRatio)
    send?.('phase', `mockup:${page.id}:${i + 1}/${imagePages.length}`)

    if (i > 0 && MOCKUP_GEN_DELAY_MS > 0) {
      await sleep(MOCKUP_GEN_DELAY_MS)
    }

    const prompt = buildMockupPrompt(page, spec)
    const imgs = await generateMockupWithRetry(prompt, aspect, imagenModel, sampleCount)
    const pageMockups: GeneratedMockup[] = imgs.map((img, sampleIdx) => {
      const isPrimary = sampleIdx === 0
      const pageId = isPrimary ? page.id : `${page.id}-alt-${sampleIdx + 1}`
      const path = isPrimary
        ? page.path?.endsWith('.png')
          ? page.path
          : pageMockupPath(page.id)
        : pageMockupPath(pageId)
      return {
        path,
        content: img.data,
        mimeType: img.mimeType,
        pageId,
      }
    })
    results.push(...pageMockups)
    await opts?.onPageMockups?.(pageMockups, page)
  }

  return results
}

export function mergeMockupsIntoPages(
  pages: DesignPageMeta[],
  mockups: GeneratedMockup[],
): DesignPageMeta[] {
  const byId = new Map(mockups.map((m) => [m.pageId, m]))
  return pages.map((p) => {
    const mockup = byId.get(p.id)
    if (!mockup) return p
    return {
      ...p,
      path: mockup.path,
      media: 'image' as const,
    }
  })
}

/** Añade pantallas alternativas (sample 2+) junto a la pantalla base. */
export function appendAltMockupPages(
  pages: DesignPageMeta[],
  basePage: DesignPageMeta,
  pageMockups: GeneratedMockup[],
  layout?: { gap?: number; pageWidth?: number },
): DesignPageMeta[] {
  const gap = layout?.gap ?? 64
  const pageWidth = layout?.pageWidth ?? 390
  const primary = pageMockups.find((m) => m.pageId === basePage.id)
  let next = primary ? mergeMockupsIntoPages(pages, [primary]) : [...pages]
  const parent = next.find((p) => p.id === basePage.id) ?? basePage

  for (const mockup of pageMockups) {
    if (mockup.pageId === basePage.id) continue
    if (next.some((p) => p.id === mockup.pageId)) {
      next = mergeMockupsIntoPages(next, [mockup])
      continue
    }
    const altNum = Number(mockup.pageId.match(/-alt-(\d+)$/)?.[1] ?? 1)
    next.push({
      ...parent,
      id: mockup.pageId,
      name: `${parent.name} (${altNum})`,
      path: mockup.path,
      media: 'image',
      width: parent.width ?? pageWidth,
      height: parent.height,
      x: (parent.x ?? 0) + ((parent.width ?? pageWidth) + gap) * altNum,
      y: parent.y ?? 0,
      regions: undefined,
    })
  }
  return next
}

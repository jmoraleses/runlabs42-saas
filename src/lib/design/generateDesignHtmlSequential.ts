import 'server-only'

import { getDesignGenModelId } from '@/lib/ai/config.server'
import { resolveVertexAgentTextModelId } from '@/lib/ai/vertexModelAllowlist'
import {
  generateAgentPlatformText,
  streamAgentPlatformText,
} from '@/lib/ai/vertexAgentPlatform'
import { applyDevicePresetToDesignFiles } from '@/lib/design/applyDevicePreset'
import {
  devicePromptContext,
  type DesignPreviewBreakpoint,
} from '@/lib/design/breakpoints'
import {
  generateDesignImagesProgressive,
  stripImageTags,
} from '@/lib/design/designImageGen'
import { resolvePhotographyStyle } from '@/lib/design/designPhotographyStyle'
import { inferDesignBriefFromPrompt } from '@/lib/design/designBrief'
import type { GenerateDesignOpts } from '@/lib/design/generateDesign'
import {
  autoLayoutPages,
  mergeDesignPages,
  mergePagesIntoSpec,
  pageHtmlPath,
  resolveDesignPages,
} from '@/lib/design/pages'
import { parseDesignPlanOutput } from '@/lib/design/parseDesignOutput'
import { parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'
import { parsePartialSinglePageHtml } from '@/lib/design/parsePartialPageHtml'
import {
  extractSiteChromeFromHtml,
  firstPageChromeInstruction,
  formatSiteChromeForPagePrompt,
  sortPagesWithHomeFirst,
  type SiteChrome,
} from '@/lib/design/extractSiteChrome'
import {
  designPlanSystemInstruction,
  designSinglePageHtmlInstruction,
  designTokensSystemInstruction,
} from '@/lib/design/prompts'
import { expandSparseDesignPlanPages } from '@/lib/design/expandDesignPlanPages'
import { ensureDesignSystemPage } from '@/lib/design/prototypePages'
import {
  estimateHtmlPageHeight,
  suggestPageHeightFromMeta,
} from '@/lib/design/pageHeight'
import { ensureDesignTokens, parseTokensJson } from '@/lib/design/themeTokens'
import { appendVisualReferenceToPrompt } from '@/lib/design/visualReference'
import { buildDesignGenerateContext, loadDesignPlan } from '@/lib/design/specKitDesignContext'
import {
  DESIGN_SPEC_JSON,
  DESIGN_SPEC_MD,
  isImageMockupPath,
  pageMockupPath,
  type DesignPageMeta,
  type DesignSpec,
} from '@/lib/design/types'

const PRIMARY_PAGE_FILTER = (p: DesignPageMeta) =>
  p.frameType !== 'prototype' &&
  p.frameType !== 'designSystem' &&
  !/-alt-\d+$/.test(p.id)

/** Páginas con HTML o mockup ya persistido (no solo planificadas en el spec). */
function loadExistingPrimaryPages(existing?: GenerateDesignOpts['existing']): DesignPageMeta[] {
  if (!existing?.length) return []
  const specRaw = existing.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
  const filePaths = new Set(existing.map((f) => f.path))
  return resolveDesignPages(existing, specRaw)
    .filter(PRIMARY_PAGE_FILTER)
    .filter((p) => {
      const htmlPath = pageHtmlPath(p.id)
      const mockupPath = p.mockupPath ?? pageMockupPath(p.id)
      return (
        filePaths.has(htmlPath) ||
        (p.path.endsWith('.html') && filePaths.has(p.path)) ||
        filePaths.has(mockupPath) ||
        (isImageMockupPath(p.path) && filePaths.has(p.path))
      )
    })
}

function seedFileMapFromExisting(
  fileMap: Map<string, { path: string; content: string }>,
  existing?: GenerateDesignOpts['existing'],
) {
  if (!existing?.length) return
  for (const f of existing) {
    if (
      f.path === DESIGN_SPEC_JSON ||
      f.path.startsWith('design/site') ||
      f.path.startsWith('design/pages') ||
      f.path.startsWith('design/mockups')
    ) {
      fileMap.set(f.path, { path: f.path, content: f.content })
    }
  }
}

function designFileContext(existing?: GenerateDesignOpts['existing']): string {
  if (!existing?.length) return ''
  return `\n\nDiseño actual (iterar):\n${existing
    .filter(
      (f) =>
        f.path.startsWith('spec/design') ||
        f.path.startsWith('design/site') ||
        f.path.startsWith('design/pages'),
    )
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n')}`
}

function parseSinglePageHtml(text: string, page: DesignPageMeta): { path: string; content: string } | null {
  const htmlPath = page.path.endsWith('.html') ? page.path : pageHtmlPath(page.id)
  const ops = parseFileOperationsFromStream(text, {
    defaultPath: htmlPath,
    existingPaths: [htmlPath],
  })
  const file = ops.find(
    (o): o is Extract<(typeof ops)[number], { type: 'create' | 'update' }> =>
      o.type !== 'delete' && o.path.endsWith('.html'),
  )
  if (!file?.content?.trim()) return null
  return { path: file.path, content: file.content.trim() }
}

/**
 * Pipeline código primero: plan → HTML visible al instante → imágenes en paralelo que se van insertando.
 */
export async function generateDesignHtmlSequential(
  prompt: string,
  device: DesignPreviewBreakpoint,
  options: GenerateDesignOpts,
): Promise<{ files: Array<{ path: string; content: string }> }> {
  const send = options.send
  const persistPartial = options.persistPartial
  const existing = options.existing
  const hasImages = Boolean(options.images?.length)
  const model = resolveVertexAgentTextModelId(options.modelId, getDesignGenModelId())

  const specContext = existing?.length
    ? buildDesignGenerateContext(existing, {
        projectName: options.projectName,
        framework: options.framework,
      })
    : ''

  const basePrompt = `${appendVisualReferenceToPrompt(prompt, hasImages)}${devicePromptContext(device)}${specContext}${designFileContext(existing)}`

  const fileMap = new Map<string, { path: string; content: string }>()
  seedFileMapFromExisting(fileMap, existing)
  const existingPrimaryPages = loadExistingPrimaryPages(existing)
  const existingPageIds = new Set(existingPrimaryPages.map((p) => p.id))

  const emitProgress = async (batch: Array<{ path: string; content: string }>) => {
    if (!batch.length) return
    for (const f of batch) fileMap.set(f.path, f)
    await persistPartial?.(batch)
    const specFile = fileMap.get(DESIGN_SPEC_JSON)
    let pages: DesignPageMeta[] | undefined
    if (specFile) {
      try {
        pages = (JSON.parse(specFile.content) as DesignSpec).pages ?? undefined
      } catch {
        pages = undefined
      }
    }
    send?.(
      'files',
      JSON.stringify({
        paths: batch.map((f) => f.path),
        pages,
      }),
    )
  }

  send?.('phase', 'plan')
  const specKitPlan = loadDesignPlan(existing ?? [])
  let spec: DesignSpec
  let pages: DesignPageMeta[]

  if (specKitPlan?.screens?.length) {
    spec = {
      version: 2,
      title: specKitPlan.title ?? 'Proyecto',
      summary: specKitPlan.summary ?? '',
      tokens: ensureDesignTokens(specKitPlan.tokens ?? {}),
      source: 'vertex',
      pages: specKitPlan.screens.map((screen) => ({
        id: screen.id,
        name: screen.name,
        path: pageHtmlPath(screen.id),
        media: 'html' as const,
        width: screen.width,
        height:
          screen.height ??
          suggestPageHeightFromMeta({ id: screen.id, name: screen.name }, device),
        x: screen.x,
        y: screen.y,
      })),
    }
    pages = mergeDesignPages(
      existingPrimaryPages,
      autoLayoutPages(
        (spec.pages ?? []).map((p) => ({
          ...p,
          media: 'html' as const,
          path: p.path?.endsWith('.html') ? p.path : pageHtmlPath(p.id),
        })),
      ),
    )
    pages = expandSparseDesignPlanPages(pages, { prompt, spec, device })
    spec = { ...spec, tokens: ensureDesignTokens(spec.tokens) }
    pages = ensureDesignSystemPage(pages, spec)
    const specKitPalette = mergePagesIntoSpec(spec, pages)
    fileMap.set(DESIGN_SPEC_JSON, { path: DESIGN_SPEC_JSON, content: specKitPalette })
    await emitProgress([...fileMap.values()])
  } else {
    const planInstruction = designPlanSystemInstruction(device)
    let planText: string
    if (options.onToken) {
      const streamed = await streamAgentPlatformText({
        prompt: basePrompt,
        systemInstruction: planInstruction,
        modelId: model,
        images: options.images,
        onToken: options.onToken,
      })
      planText = streamed.text
    } else {
      planText = await generateAgentPlatformText(basePrompt, {
        systemInstruction: planInstruction,
        temperature: 0.4,
        model,
        images: options.images,
      })
    }

    const planParsed = parseDesignPlanOutput(planText)
    if (!planParsed.spec) {
      throw new Error('El plan no generó spec/design.json con páginas HTML')
    }

    spec = { ...planParsed.spec, source: 'vertex' }
    pages = mergeDesignPages(
      existingPrimaryPages,
      autoLayoutPages(
        (spec.pages ?? []).map((p) => ({
          ...p,
          media: 'html' as const,
          path: p.path?.endsWith('.html') ? p.path : pageHtmlPath(p.id),
        })),
      ),
    )
    pages = expandSparseDesignPlanPages(pages, { prompt, spec, device })
    spec = { ...spec, tokens: ensureDesignTokens(spec.tokens) }
    pages = ensureDesignSystemPage(pages, spec)
    const planWithPalette = mergePagesIntoSpec(spec, pages)
    fileMap.set(DESIGN_SPEC_JSON, { path: DESIGN_SPEC_JSON, content: planWithPalette })
    await emitProgress([...fileMap.values()])

    const planFiles = planParsed.files.filter(
      (f) => f.path === DESIGN_SPEC_JSON || f.path === DESIGN_SPEC_MD,
    )
    for (const f of planFiles.filter((f) => f.path !== DESIGN_SPEC_JSON)) {
      fileMap.set(f.path, f)
    }
  }

  send?.('phase', 'tokens')
  spec = {
    ...spec,
    tokens: ensureDesignTokens(spec.tokens),
  }
  const paletteReady =
    Boolean(spec.tokens?.colors?.secondary) && Boolean(spec.tokens?.colors?.tertiary)
  if (!paletteReady) {
    try {
      const tokensText = await generateAgentPlatformText(
        `${basePrompt}\n\nProducto: ${spec.title}\nResumen: ${spec.summary ?? ''}`,
        {
          systemInstruction: designTokensSystemInstruction(),
          temperature: 0.35,
          model,
          images: options.images,
        },
      )
      const parsed = parseTokensJson(tokensText)
      if (parsed) {
        spec = {
          ...spec,
          tokens: ensureDesignTokens({
            ...spec.tokens,
            ...parsed,
            colors: { ...spec.tokens?.colors, ...parsed.colors },
          }),
        }
      }
    } catch (err) {
      console.warn(
        '[design] tokens:',
        err instanceof Error ? err.message : err,
      )
      spec = { ...spec, tokens: ensureDesignTokens(spec.tokens) }
    }
  }

  pages = ensureDesignSystemPage(pages, spec)
  pages = pages.map((p) => ({
    ...p,
    height: p.height ?? suggestPageHeightFromMeta(p, device),
  }))
  const planSpecContent = mergePagesIntoSpec(spec, pages)
  fileMap.set(DESIGN_SPEC_JSON, { path: DESIGN_SPEC_JSON, content: planSpecContent })
  await emitProgress([...fileMap.values()])

  const pageInstruction = designSinglePageHtmlInstruction(device)
  const primaryPages = sortPagesWithHomeFirst(pages.filter(PRIMARY_PAGE_FILTER))
  const pagesToGenerate = primaryPages.filter((p) => !existingPageIds.has(p.id))
  let publishedPages: DesignPageMeta[] = [...existingPrimaryPages]
  let newPublished: DesignPageMeta[] = []
  let siteChrome: SiteChrome | null = null

  const imageTasks: Promise<unknown>[] = []
  const designMdForImages =
    fileMap.get(DESIGN_SPEC_MD)?.content ??
    existing?.find((f) => f.path === DESIGN_SPEC_MD)?.content
  const photographyStyle = resolvePhotographyStyle({
    designMd: designMdForImages,
    brief: inferDesignBriefFromPrompt(prompt),
  })

  for (let i = 0; i < pagesToGenerate.length; i++) {
    const page = pagesToGenerate[i]!
    send?.('phase', `page:${page.id}:${i + 1}/${pagesToGenerate.length}`)

    const chromeContext =
      i === 0
        ? firstPageChromeInstruction(page.name)
        : siteChrome
          ? formatSiteChromeForPagePrompt(siteChrome, page.name)
          : ''

    const pagePrompt = `${basePrompt}

Genera ÚNICAMENTE la pantalla "${page.name}" (id: ${page.id}).
Ruta de salida obligatoria: ${page.path.endsWith('.html') ? page.path : pageHtmlPath(page.id)}
Producto: ${spec.title}
Resumen: ${spec.summary ?? ''}
Tokens (obligatorio, no inventes otros colores): ${JSON.stringify(spec.tokens ?? {}, null, 2)}
Pantallas del sitio (contexto): ${primaryPages.map((p) => p.name).join(', ')}${chromeContext}`

    let pageAcc = ''
    let lastPartialEmitAt = 0
    let lastPartialEmitLen = 0
    const PARTIAL_EMIT_MS = 350
    const MIN_PARTIAL_CHARS = 100

    const maybeEmitPartialPageHtml = async (force = false) => {
      const partial = parsePartialSinglePageHtml(pageAcc, page)
      if (!partial?.content?.trim()) return
      const len = partial.content.length
      if (!force && len < MIN_PARTIAL_CHARS) return
      if (!force && len - lastPartialEmitLen < 60 && len < MIN_PARTIAL_CHARS * 2) return
      const now = Date.now()
      if (!force && now - lastPartialEmitAt < PARTIAL_EMIT_MS) return
      lastPartialEmitAt = now
      lastPartialEmitLen = len
      const resolvedHtmlPath = partial.path.endsWith('.html')
        ? partial.path
        : pageHtmlPath(page.id)
      await emitProgress([
        {
          path: resolvedHtmlPath,
          content: stripImageTags(partial.content),
        },
      ])
    }

    const pageText = await streamAgentPlatformText({
      prompt: pagePrompt,
      systemInstruction: pageInstruction,
      modelId: model,
      onToken: (chunk) => {
        pageAcc += chunk
        options.onToken?.(chunk)
        void maybeEmitPartialPageHtml()
      },
    }).then((r) => r.text)

    await maybeEmitPartialPageHtml(true)

    const pageFile = parseSinglePageHtml(pageText, page)
    if (!pageFile) {
      console.warn(`[design] página ${page.id}: sin HTML en respuesta`)
      continue
    }

    const progress = `${i + 1}/${pagesToGenerate.length}`
    const resolvedHtmlPath = pageFile.path.endsWith('.html')
      ? pageFile.path
      : pageHtmlPath(page.id)
    const pageHtmlStripped = {
      ...pageFile,
      path: resolvedHtmlPath,
      content: stripImageTags(pageFile.content),
    }

    if (!siteChrome) {
      siteChrome =
        extractSiteChromeFromHtml(pageHtmlStripped.content, {
          pageId: page.id,
          pageName: page.name,
        }) ?? siteChrome
    }

    const pageWidth = page.width ?? spec.pages?.find((x) => x.id === page.id)?.width
    const measuredHeight = estimateHtmlPageHeight(
      pageHtmlStripped.content,
      pageWidth ?? 1280,
    )
    newPublished = [
      ...newPublished.filter((p) => p.id !== page.id),
      {
        ...page,
        path: resolvedHtmlPath,
        media: 'html' as const,
        height: measuredHeight,
      },
    ]
    publishedPages = mergeDesignPages(existingPrimaryPages, newPublished)
    const layoutPages = publishedPages
    spec = { ...spec, source: 'vertex' }
    const updatedSpec = mergePagesIntoSpec(spec, layoutPages)

    await emitProgress([
      pageHtmlStripped,
      { path: DESIGN_SPEC_JSON, content: updatedSpec },
    ])

    const imageTask = generateDesignImagesProgressive([pageText, pageFile.content], {
      send,
      pageId: page.id,
      pageProgress: progress,
      pageHtmlPath: resolvedHtmlPath,
      photographyStyle,
      onImageReady: async (img) => {
        await emitProgress([
          { path: img.path, content: img.content },
        ])
      },
    }).catch((err) => {
      console.warn(`[design] imágenes ${page.id}:`, err instanceof Error ? err.message : err)
    })

    imageTasks.push(imageTask)
  }

  await Promise.all(imageTasks)

  const files = applyDevicePresetToDesignFiles([...fileMap.values()], device)
  return { files }
}

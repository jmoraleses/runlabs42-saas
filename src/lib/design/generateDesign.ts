import 'server-only'

import {
  generateAgentPlatformText,
  streamAgentPlatformText,
  type VertexImagePart,
} from '@/lib/ai/vertexAgentPlatform'
import { getDesignGenModelId, getMockupGenFastModelId } from '@/lib/ai/config.server'
import { resolveVertexAgentTextModelId } from '@/lib/ai/vertexModelAllowlist'
import { analyzeMockupRegions } from '@/lib/design/analyzeMockupRegions'
import {
  designStructureSystemInstruction,
  designGenerateSystemInstruction,
  designIterateSystemInstruction,
  designFigmaImportSystemInstruction,
  DESIGN_REIMAGINE_SYSTEM,
  getDesignToCodeSystem,
} from '@/lib/design/prompts'
import type { CodeTemplate } from '@/lib/codeTemplates'
import { normalizeCodeTemplate } from '@/lib/codeTemplates'
import { appendVisualReferenceToPrompt } from '@/lib/design/visualReference'
import { applyDevicePresetToDesignFiles } from '@/lib/design/applyDevicePreset'
import {
  devicePromptContext,
  type DesignPreviewBreakpoint,
} from '@/lib/design/breakpoints'
import { buildDesignGenerateContext } from '@/lib/design/specKitDesignContext'
import {
  parseDesignGeneration,
  parseDesignVariants,
  parseImageVariantPrompts,
  parsePageImagePromptUpdate,
} from '@/lib/design/parseDesignOutput'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'
import {
  autoLayoutPages,
  mergePagesIntoSpec,
  pageHtmlPath,
  resolveDesignPages,
} from '@/lib/design/pages'
import {
  DESIGN_SPEC_JSON,
  pageMockupPath,
  type DesignPageMeta,
  type DesignSpec,
  isCanvasImagePage,
} from '@/lib/design/types'
import {
  generateDesignImagesFromOutput,
  mergeDesignFilesWithImages,
  stripImageTagsFromDesignFiles,
} from '@/lib/design/designImageGen'
import { resolvePhotographyStyle } from '@/lib/design/designPhotographyStyle'

export function designTextModel(modelId?: string | null): string {
  return resolveVertexAgentTextModelId(modelId, getDesignGenModelId())
}
import {
  generateMockupsFromSpec,
  appendAltMockupPages,
  augmentImagenMockupPrompt,
  imagenMockupPredictOpts,
  type GeneratedMockup,
} from '@/lib/design/generateDesignMockups'
import { generateDesignHtmlSequential } from '@/lib/design/generateDesignHtmlSequential'
import { generatePageHtml } from '@/lib/design/generateHtmlFromMockups'
import { clampMockupSampleCount } from '@/lib/design/mockupSampleCount'
import { generateImagen4Image } from '@/lib/ai/vertexAgentPlatform'

export { ensureDesignSpecFile } from '@/lib/design/designFiles'

function designFileContext(existing?: ProjectFileRecord[]): string {
  if (!existing?.length) return ''
  return `\n\nDiseño actual (iterar):\n${existing
    .filter(
      (f) =>
        f.path.startsWith('spec/design') ||
        f.path.startsWith('design/site') ||
        f.path.startsWith('design/pages') ||
        f.path.startsWith('design/mockups'),
    )
    .map((f) => {
      if (f.path.endsWith('.png')) return `--- ${f.path} --- (PNG mockup)`
      return `--- ${f.path} ---\n${f.content}`
    })
    .join('\n')}`
}

function shouldUseImagePipeline(existing?: ProjectFileRecord[]): boolean {
  const specFile = existing?.find((f) => f.path === DESIGN_SPEC_JSON)
  if (specFile?.content) {
    try {
      const spec = JSON.parse(specFile.content) as DesignSpec
      if (spec.source === 'vertex-imagen') return true
      if (spec.pages?.some((p) => p.media === 'image')) return true
    } catch {
      /* ignore */
    }
  }
  if (process.env.DESIGN_PIPELINE === 'html') return false
  if (process.env.DESIGN_PIPELINE === 'imagen') return true
  return false
}

async function finalizeStructureFiles(
  text: string,
  device: DesignPreviewBreakpoint,
  opts?: Pick<GenerateDesignOpts, 'send' | 'modelId' | 'persistPartial' | 'mockupSampleCount'>,
): Promise<{ files: Array<{ path: string; content: string }> }> {
  const send = opts?.send
  const modelId = opts?.modelId
  const persistPartial = opts?.persistPartial
  const mockupSampleCount = clampMockupSampleCount(opts?.mockupSampleCount ?? 1)

  const emitProgress = async (batch: Array<{ path: string; content: string }>) => {
    if (!batch.length) return
    await persistPartial?.(batch)
    const specRaw = batch.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    const pageRefs = batch.map((f) => ({ path: f.path }))
    const resolvedPages = specRaw
      ? resolveDesignPages(pageRefs, specRaw)
      : undefined
    send?.(
      'files',
      JSON.stringify({
        paths: batch.map((f) => f.path),
        pages: resolvedPages,
      }),
    )
  }

  send?.('phase', 'structure')
  const { files, spec, pipeline } = parseDesignGeneration(text)

  if (pipeline === 'html') {
    const pages = autoLayoutPages(resolveDesignPages(files, spec ? JSON.stringify(spec) : null))
    const specContent = mergePagesIntoSpec(spec, pages)
    let withSpec = files.some((f) => f.path === DESIGN_SPEC_JSON)
      ? files.map((f) => (f.path === DESIGN_SPEC_JSON ? { ...f, content: specContent } : f))
      : [...files, { path: DESIGN_SPEC_JSON, content: specContent }]
    withSpec = applyDevicePresetToDesignFiles(withSpec, device)
    const htmlFiles = withSpec.filter((f) => f.path.endsWith('.html'))
    const images = await generateDesignImagesFromOutput(
      [text, ...htmlFiles.map((f) => f.content)],
      send,
      { htmlFiles },
    )
    return { files: mergeDesignFilesWithImages(stripImageTagsFromDesignFiles(withSpec), images) }
  }

  if (!spec) throw new Error('No se generó spec/design.json')

  let pages = autoLayoutPages(
    resolveDesignPages(files, JSON.stringify(spec)).length
      ? resolveDesignPages(files, JSON.stringify(spec))
      : (spec.pages ?? []).map((p) => ({
          ...p,
          path: p.path || pageMockupPath(p.id),
          media: 'image' as const,
        })),
  )

  const imagePages = pages.map((p) => ({
    ...p,
    path: p.path?.endsWith('.png') ? p.path : pageMockupPath(p.id),
    media: 'image' as const,
  }))
  const preliminarySpec: DesignSpec = {
    ...spec,
    source: 'vertex-imagen',
    pages: [],
  }
  const preliminarySpecContent = JSON.stringify(preliminarySpec, null, 2)
  const textFiles = files.filter((f) => !f.path.endsWith('.png'))
  const preliminaryTextFiles = textFiles.some((f) => f.path === DESIGN_SPEC_JSON)
    ? textFiles.map((f) =>
        f.path === DESIGN_SPEC_JSON ? { ...f, content: preliminarySpecContent } : f,
      )
    : [...textFiles, { path: DESIGN_SPEC_JSON, content: preliminarySpecContent }]
  await emitProgress(preliminaryTextFiles)
  pages = imagePages

  send?.('phase', 'mockups')
  let mockups: GeneratedMockup[] = []
  let runningPages: DesignPageMeta[] = []
  const htmlFiles: Array<{ path: string; content: string }> = []
  try {
    mockups = await generateMockupsFromSpec(spec, pages, send, {
      modelId,
      sampleCount: mockupSampleCount,
      onPageMockups: async (pageMockups, page) => {
        runningPages = appendAltMockupPages(runningPages, page, pageMockups)
        await emitProgress([
          ...pageMockups.map((m) => ({ path: m.path, content: m.content })),
          {
            path: DESIGN_SPEC_JSON,
            content: JSON.stringify(
              { ...spec, source: 'vertex-imagen' as const, pages: runningPages },
              null,
              2,
            ),
          },
        ])

        const primaryMockup = pageMockups.find((m) => m.pageId === page.id)
        if (!primaryMockup || page.media === 'html') return

        send?.('phase', `html:${page.id}`)
        let analyzed: DesignPageMeta = page
        try {
          const regions = await analyzeMockupRegions(primaryMockup.content, page, modelId)
          if (regions.length) analyzed = { ...page, regions }
        } catch {
          /* continuar sin regiones */
        }
        runningPages = runningPages.map((p) => (p.id === page.id ? analyzed : p))

        try {
          const htmlPath = pageHtmlPath(page.id)
          const content = await generatePageHtml(analyzed, spec, primaryMockup, device, modelId)
          const file = { path: htmlPath, content }
          htmlFiles.push(file)
          const mockupPath = page.path?.endsWith('.png') ? page.path : pageMockupPath(page.id)
          runningPages = runningPages.map((p) =>
            p.id === page.id
              ? {
                  ...p,
                  path: htmlPath,
                  media: 'html' as const,
                  mockupPath,
                }
              : p,
          )
          await emitProgress([
            file,
            {
              path: DESIGN_SPEC_JSON,
              content: JSON.stringify(
                { ...spec, source: 'vertex-imagen' as const, pages: runningPages },
                null,
                2,
              ),
            },
          ])
        } catch (htmlErr) {
          console.warn(`[design] HTML ${page.id} failed:`, htmlErr)
        }
      },
    })
  } catch (mockupErr) {
    console.warn('[design] mockup generation failed:', mockupErr)
    send?.('phase', 'mockups-failed')
    if (!mockups.length) {
      return { files: preliminaryTextFiles }
    }
  }

  const pagesWithHtml = runningPages.length ? runningPages : pages

  const specWithPages: DesignSpec = {
    ...spec,
    source: 'vertex-imagen',
    pages: pagesWithHtml,
  }
  const specContent = JSON.stringify(specWithPages, null, 2)

  const finalTextFiles = files.filter((f) => !f.path.endsWith('.png'))
  const withSpec = finalTextFiles.some((f) => f.path === DESIGN_SPEC_JSON)
    ? finalTextFiles.map((f) => (f.path === DESIGN_SPEC_JSON ? { ...f, content: specContent } : f))
    : [...finalTextFiles, { path: DESIGN_SPEC_JSON, content: specContent }]

  const mockupFiles = mockups.map((m) => ({ path: m.path, content: m.content }))
  return { files: [...withSpec, ...mockupFiles, ...htmlFiles] }
}

import {
  type DesignBrief,
  composeDesignBriefBlock,
  inferDesignBriefFromPrompt,
  mergeDesignBrief,
} from '@/lib/design/designBrief'
import { generateOrchestratedDesign } from '@/lib/design/orchestration'

export type GenerateDesignOpts = {
  existing?: ProjectFileRecord[]
  projectName?: string
  framework?: string
  modelId?: string
  device?: DesignPreviewBreakpoint
  images?: VertexImagePart[]
  fromFigma?: boolean
  /** Forzar pipeline HTML legacy. */
  htmlPipeline?: boolean
  /** Usar orquestación modular de agentes. */
  orchestrate?: boolean
  /** Brief estructurado (tono, tipo de sitio, secciones). */
  brief?: DesignBrief
  onToken?: (chunk: string) => void
  send?: (type: string, data: string) => void
  persistPartial?: (files: Array<{ path: string; content: string }>) => Promise<void>
  mockupSampleCount?: number
  /** Generar assets [IMAGE:] durante orquestación (por defecto false). */
  generateImages?: boolean
  /** Modelo de imagen Vertex (compositor Studio). */
  imageModelId?: string
  /** Cancelación del cliente (botón Parar en Studio). */
  signal?: AbortSignal
  /** Una pantalla nueva por prompt (no sobrescribir existentes). */
  forceNewPage?: boolean
  /** Alias de forceNewPage desde el Studio. */
  newPageOnly?: boolean
  /** Sustituye el diseño persistido (nueva web en el mismo proyecto). */
  replaceDesign?: boolean
  /** Regenerar HTML solo de estas pantallas; el resto no se modifica. */
  rebuildPageIds?: string[]
  referencePageId?: string
  elementContexts?: Array<{ skId: string; tagName: string; text?: string }>
}

export async function generateDesignFromPrompt(
  prompt: string,
  opts?: GenerateDesignOpts | ProjectFileRecord[],
): Promise<{ files: Array<{ path: string; content: string }> }> {
  const options: GenerateDesignOpts = Array.isArray(opts) ? { existing: opts } : (opts ?? {})

  if (options.orchestrate) {
    return generateOrchestratedDesign(prompt, {
      device: options.device,
      images: options.images,
      modelId: options.modelId,
      brief: options.brief ?? { prompt },
      existing: options.existing,
      forceNewPage: options.replaceDesign
        ? false
        : (options.forceNewPage ?? options.newPageOnly),
      replaceDesign: options.replaceDesign,
      rebuildPageIds: options.rebuildPageIds,
      referencePageId: options.referencePageId,
      elementContexts: options.elementContexts,
      generateImages: options.generateImages,
      imageModelId: options.imageModelId,
      onToken: options.onToken,
      send: options.send,
      persistPartial: options.persistPartial,
      signal: options.signal,
    })
  }

  const existing = options.existing
  const device = options.device ?? 'desktop'
  const hasImages = Boolean(options.images?.length)
  const imagePipeline = !options.htmlPipeline && !options.fromFigma && shouldUseImagePipeline(existing)

  if (!imagePipeline && !options.fromFigma && process.env.DESIGN_HTML_SEQUENTIAL !== '0') {
    return generateDesignHtmlSequential(prompt, device, options)
  }

  const systemInstruction = options.fromFigma
    ? designFigmaImportSystemInstruction(device)
    : imagePipeline
      ? designStructureSystemInstruction(device)
      : designGenerateSystemInstruction(device)

  const fullPrompt = `${appendVisualReferenceToPrompt(prompt, hasImages)}${devicePromptContext(device)}${designFileContext(existing)}`
  const model = designTextModel(options.modelId)

  let text: string
  if (options.onToken) {
    const streamed = await streamAgentPlatformText({
      prompt: fullPrompt,
      systemInstruction,
      modelId: model,
      images: options.images,
      onToken: options.onToken,
    })
    text = streamed.text
  } else {
    text = await generateAgentPlatformText(fullPrompt, {
      systemInstruction,
      temperature: 0.45,
      model,
      images: options.images,
    })
  }

  return finalizeStructureFiles(text, device, options)
}

export async function iterateDesignPage(params: {
  prompt: string
  pagePath: string
  pageId: string
  html?: string
  pngBase64?: string
  pageMeta?: DesignPageMeta
  spec?: DesignSpec
  elementContext?: { skId: string; tagName: string; text?: string }
  elementContexts?: Array<{ skId: string; tagName: string; text?: string }>
  images?: VertexImagePart[]
  device?: DesignPreviewBreakpoint
  brief?: DesignBrief
  tokensJson?: string
  layoutJson?: string
}): Promise<{
  path: string
  content: string
  imageFiles?: Array<{ path: string; content: string }>
  updatedImagePrompt?: string
}> {
  const device = params.device ?? 'desktop'
  const elementContexts =
    params.elementContexts?.length
      ? params.elementContexts
      : params.elementContext
        ? [params.elementContext]
        : []
  const elementSkIds = elementContexts.map((c) => c.skId).filter(Boolean)
  const isImagePage =
    params.pageMeta?.media === 'image' || params.pagePath.endsWith('.png')

  const brief = mergeDesignBrief(
    params.brief ?? { prompt: params.prompt },
    inferDesignBriefFromPrompt(params.prompt),
  )
  const orchestrationContext = [
    composeDesignBriefBlock(brief),
    params.tokensJson ? `## Design tokens\n${params.tokensJson}` : '',
    params.layoutJson ? `## Layout\n${params.layoutJson}` : '',
    `## Cambio solicitado\n${params.prompt}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  if (isImagePage) {
    const el = elementContexts.length
      ? `\n\nRegión/elemento: ${elementContexts.map((c) => c.skId).join(', ')}`
      : ''
    const currentPrompt = params.pageMeta?.imagePrompt ?? ''
    const text = await generateAgentPlatformText(
      `${appendVisualReferenceToPrompt(orchestrationContext, Boolean(params.images?.length))}${devicePromptContext(device)}${el}\n\nPrompt actual:\n${currentPrompt}\n\nPantalla: ${params.pageMeta?.name ?? params.pageId}`,
      {
        systemInstruction: designIterateSystemInstruction(device, 'image'),
        temperature: 0.4,
        model: designTextModel(),
        images: params.images,
      },
    )
    const updatedPrompt = parsePageImagePromptUpdate(text)
    if (!updatedPrompt) throw new Error('El modelo no devolvió imagePrompt actualizado')

    const { isDesignImageGenerationEnabled } = await import(
      '@/lib/platform/designImageGenerationSetting.server'
    )
    if (!(await isDesignImageGenerationEnabled())) {
      throw new Error('La generación de imágenes está desactivada en el panel de administración')
    }

    const aspect = params.pageMeta?.aspectRatio ?? '16:9'
    const img = await generateImagen4Image(augmentImagenMockupPrompt(updatedPrompt), {
      ...imagenMockupPredictOpts(aspect, getMockupGenFastModelId()),
    })
    if (!img) throw new Error('Imagen 4 no generó mockup')

    return {
      path: params.pagePath,
      content: img.data,
      imageFiles: [{ path: params.pagePath, content: img.data }],
      updatedImagePrompt: updatedPrompt,
    }
  }

  const html = params.html ?? ''
  const el = elementContexts.length
    ? elementContexts.length === 1
      ? `\n\nElemento seleccionado: <${elementContexts[0]!.tagName}> data-sk-id="${elementContexts[0]!.skId}"${elementContexts[0]!.text ? ` texto="${elementContexts[0]!.text}"` : ''}\n\nIMPORTANTE: Aplica el cambio SOLO en ese elemento. Si pides crear o sustituir una imagen, emite como mucho UN [IMAGE:] para esa imagen y actualiza únicamente el <img> (o equivalente) dentro del elemento marcado. No regeneres ni añadas imágenes en otras partes de la página.`
      : `\n\nElementos seleccionados:\n${elementContexts.map((c, i) => `${i + 1}. <${c.tagName}> data-sk-id="${c.skId}"${c.text ? ` texto="${c.text}"` : ''}`).join('\n')}\n\nIMPORTANTE: Aplica los cambios SOLO en esos elementos. Si pides crear o sustituir imágenes, emite [IMAGE:] únicamente para las imágenes de esos elementos. No regeneres ni añadas imágenes en otras partes de la página.`
    : ''
  const hasImages = Boolean(params.images?.length)
  const text = await generateAgentPlatformText(
    `${appendVisualReferenceToPrompt(orchestrationContext, hasImages)}${devicePromptContext(device)}${el}\n\n--- ${params.pagePath} ---\n${html}`,
    {
      systemInstruction: designIterateSystemInstruction(device, 'html'),
      temperature: 0.4,
      model: designTextModel(),
      images: params.images,
    },
  )
  const { parseFileOperationsFromStream } = await import('@/lib/ai/parseAssistantOutput')
  const ops = parseFileOperationsFromStream(text, {
    defaultPath: params.pagePath,
    existingPaths: [params.pagePath],
  })
  const file = ops.find(
    (o): o is Extract<(typeof ops)[number], { type: 'create' | 'update' }> =>
      o.type !== 'delete' && o.path.endsWith('.html'),
  )
  if (!file?.content) throw new Error('El modelo no devolvió HTML actualizado')

  const htmlPath = file.path || params.pagePath
  const photographyStyle = resolvePhotographyStyle({ brief })
  const { userPromptRequestsImageChanges } = await import('@/lib/design/designModifyPrompts')
  const wantsImageWork =
    userPromptRequestsImageChanges(params.prompt) || /\[IMAGE:/i.test(file.content)
  let imageFiles: Array<{ path: string; content: string }> | undefined
  if (wantsImageWork) {
    const images = await generateDesignImagesFromOutput([text, file.content], undefined, {
      htmlFiles: [{ path: htmlPath, content: file.content }],
      elementSkIds: elementSkIds.length ? elementSkIds : undefined,
      photographyStyle,
      brief,
    })
    imageFiles = images.map((img) => ({ path: img.path, content: img.content }))
  }
  const htmlContent = stripImageTagsFromDesignFiles([
    { path: htmlPath, content: file.content },
  ])[0]!.content

  return {
    path: htmlPath,
    content: htmlContent,
    imageFiles,
  }
}

const REIMAGINE_FORMAT_REMINDER = `

Responde ÚNICAMENTE con los bloques markdown solicitados (sin texto introductorio ni conclusiones).`

export async function reimagineDesignVariants(
  prompt: string,
  existingHtml: string,
  designJson?: string,
  elementContext?: { skId: string; tagName: string; text?: string },
  opts?: { pageMeta?: DesignPageMeta; pngBase64?: string },
): Promise<Array<{ path: string; content: string }>> {
  const isImagePage =
    Boolean(opts?.pngBase64) ||
    (opts?.pageMeta != null && isCanvasImagePage(opts.pageMeta))

  const el = elementContext
    ? `\n\nVaría solo el elemento: <${elementContext.tagName}> sk-id="${elementContext.skId}"`
    : ''

  const baseContext = isImagePage
    ? `Prompt base:\n${opts?.pageMeta?.imagePrompt ?? ''}\n\nTokens:\n${designJson ?? '{}'}`
    : `HTML base:\n${existingHtml}\n\nTokens:\n${designJson ?? '{}'}`

  const formatHint = isImagePage
    ? '\n\nGenera al menos 2 variantes en bloques `json design/variants/vN/prompt.json` con { "imagePrompt": "..." } en inglés.'
    : '\n\nGenera al menos 2 variantes en bloques `html design/variants/vN/index.html`.'

  const requestReimagineText = (extraReminder = '') =>
    generateAgentPlatformText(
      `${prompt}${el}${formatHint}${REIMAGINE_FORMAT_REMINDER}${extraReminder}\n\n${baseContext}`,
      {
        systemInstruction: DESIGN_REIMAGINE_SYSTEM,
        temperature: 0.55,
        model: designTextModel(),
      },
    )

  let text = await requestReimagineText()

  if (isImagePage) {
    let variantPrompts = parseImageVariantPrompts(text)
    if (!variantPrompts.length) {
      text = await requestReimagineText(
        '\n\nLa respuesta anterior no incluyó bloques válidos. Repite SOLO con fences `json design/variants/v1/prompt.json`, v2, etc.',
      )
      variantPrompts = parseImageVariantPrompts(text)
    }
    if (!variantPrompts.length) {
      throw new Error(
        'No se generaron variantes: el modelo no devolvió bloques design/variants/vN/prompt.json',
      )
    }

    const { isDesignImageGenerationEnabled } = await import(
      '@/lib/platform/designImageGenerationSetting.server'
    )
    if (!(await isDesignImageGenerationEnabled())) {
      throw new Error('La generación de imágenes está desactivada en el panel de administración')
    }

    const aspect = opts?.pageMeta?.aspectRatio ?? '16:9'
    const results: Array<{ path: string; content: string }> = []
    for (const v of variantPrompts) {
      const img = await generateImagen4Image(augmentImagenMockupPrompt(v.imagePrompt), {
        ...imagenMockupPredictOpts(aspect, getMockupGenFastModelId()),
      })
      if (img) {
        results.push({
          path: `design/variants/${v.variantId}/${opts?.pageMeta?.id ?? 'screen'}.png`,
          content: img.data,
        })
      }
    }
    if (!results.length) throw new Error('Imagen 4 no generó variantes')
    return results
  }

  let variants = parseDesignVariants(text)
  if (!variants.length) {
    text = await requestReimagineText(
      '\n\nLa respuesta anterior no incluyó bloques válidos. Repite SOLO con fences `html design/variants/v1/index.html`, v2, etc.',
    )
    variants = parseDesignVariants(text)
  }
  if (!variants.length) {
    throw new Error(
      'No se generaron variantes: el modelo no devolvió bloques design/variants/vN/index.html',
    )
  }
  return variants
}

export async function generateCodeFromDesign(params: {
  prompt: string
  framework: string
  projectName: string
  designFiles: ProjectFileRecord[]
  selectedPageIds?: string[]
  modelId?: string
  codeTemplate?: CodeTemplate
}): Promise<string> {
  const codeTemplate = normalizeCodeTemplate(params.codeTemplate)
  const { buildConvertBundle } = await import('@/lib/design/buildConvertBundle')
  const { bundle, pageIds, imageParts } = buildConvertBundle(
    params.designFiles,
    params.selectedPageIds ?? [],
  )
  const viewsLine =
    pageIds.length > 0
      ? `Vistas a implementar (solo estas): ${pageIds.join(', ')}\n`
      : ''

  return generateAgentPlatformText(
    `Plantilla: ${codeTemplate}\nFramework: ${params.framework}\nProyecto: ${params.projectName}\n${viewsLine}\n${params.prompt}\n\n${bundle}`,
    {
      systemInstruction: getDesignToCodeSystem(codeTemplate),
      temperature: 0.35,
      model: designTextModel(params.modelId),
      images: imageParts.length ? imageParts : undefined,
    },
  )
}

export async function streamCodeFromDesign(params: {
  prompt: string
  framework: string
  projectName: string
  designFiles: ProjectFileRecord[]
  selectedPageIds: string[]
  modelId?: string
  codeTemplate?: CodeTemplate
  onToken: (chunk: string) => void
}): Promise<string> {
  const codeTemplate = normalizeCodeTemplate(params.codeTemplate)
  const { buildConvertBundle, assertSelectedPages } = await import(
    '@/lib/design/buildConvertBundle'
  )
  const { streamAgentPlatformText } = await import('@/lib/ai/vertexAgentPlatform')
  const { buildDesignGenerateContext } = await import('@/lib/design/specKitDesignContext')

  assertSelectedPages(params.designFiles, params.selectedPageIds)
  const { bundle, pageIds, imageParts } = buildConvertBundle(
    params.designFiles,
    params.selectedPageIds,
  )
  const specContext = buildDesignGenerateContext(params.designFiles, {
    projectName: params.projectName,
    framework: params.framework,
  })

  const result = await streamAgentPlatformText({
    prompt: `Plantilla: ${codeTemplate}\nFramework: ${params.framework}\nProyecto: ${params.projectName}\nVistas a implementar (solo estas): ${pageIds.join(', ')}\n\n${params.prompt}${specContext}\n\n${bundle}`,
    systemInstruction: getDesignToCodeSystem(codeTemplate),
    modelId: designTextModel(params.modelId),
    images: imageParts.length ? imageParts : undefined,
    onToken: params.onToken,
  })
  return result.text
}

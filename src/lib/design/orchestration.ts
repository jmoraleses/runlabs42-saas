import 'server-only'
import { isRequestAborted, throwIfAborted } from '@/lib/server/benignSocketErrors'
import {
  generateAgentPlatformText,
  streamAgentPlatformText,
  type VertexImagePart,
} from '@/lib/ai/vertexAgentPlatform'
import { getDesignGenModelId } from '@/lib/ai/config.server'
import { isDesignAgentStudioEnabled } from '@/lib/design/agentStudio/config.server'
import { runDesignAgentOrchestration } from '@/lib/design/agentStudio/runOrchestration'
import {
  alignDesignMdColorsToBrief,
  buildStitchStyleDesignMd,
  designMdExcerpt,
  designMdIsRichEnough,
  designMdThemeCssFile,
  envelopeFromDesignMd,
  resolveDesignMdFromModel,
  tokensJsonFromDesignMd,
} from '@/lib/design/designMd'
import {
  preferMonolithicDesignMd,
  runMonolithicDesignMdBuild,
  runSequentialDesignMdBuild,
} from '@/lib/design/designMdSequential'
import { wrapOrchestrationPhaseSend } from '@/lib/design/orchestrationPhases'
import {
  runMonolithicPageHtmlBuild,
  runSequentialPageHtmlBuild,
} from '@/lib/design/htmlPageSequential'
import {
  isOrchestrationHtmlReviewEnabled,
  runPageHtmlVisualReview,
} from '@/lib/design/orchestrationHtmlReview'
import {
  isStitchParityEnabled,
  stitchLayoutParityHints,
  stitchReferencePromptBlocks,
  type StitchReferenceBundle,
} from '@/lib/design/stitchParity'
import { resolveStitchReferenceForOrchestration } from '@/lib/design/stitchReference'
import {
  mergeOrchestrationImageParts,
  orchestrationHasVisualReference,
} from '@/lib/design/orchestrationVisualContext'
import {
  inferVisualBriefFromImages,
  mergeVisualInferenceIntoBrief,
  layoutPagesFromVisualProfile,
  siteTypeFromVisualTopology,
  isVisualProfileActionable,
  visualAuditPromptBlock,
  visualReferenceLayoutHintsFromProfile,
  type VisualBriefInference,
} from '@/lib/design/visualBriefInference'
import { VisualAuditRequiredError } from '@/lib/design/visualAuditErrors'
import {
  isGenericAgencyLandingHtml,
  validateHtmlAgainstVisualProfile,
  visualReferenceHtmlStructureBlock,
} from '@/lib/design/visualHtmlFidelity'
import {
  snapVisualColorsToDesignMd,
  visualReferenceBadgeHtmlBlock,
} from '@/lib/design/visualColorRoles'
import { isDesignPreviewPlaceholderHtml } from '@/lib/design/isDesignPreviewPlaceholderHtml'
import {
  persistIncrementalPageHtml,
  preferIncrementalOrchestrationHtml,
} from '@/lib/design/orchestrationIncrementalHtml'
import {
  assetPlannerSystemInstruction,
  tokensReviewSystemInstruction,
  layoutOrchestratorSystemInstruction,
} from '@/lib/design/orchestrationPrompts'
import {
  envelopeFromModelJson,
  envelopeToTokensJson,
  mergeOrchestrationEnvelopes,
  orchestrationEnvelopeHasContent,
  parseTokensJsonEnvelope,
  type OrchestrationTokenEnvelope,
} from '@/lib/design/normalizeDesignTokens'
import { type DesignPreviewBreakpoint, DESIGN_BREAKPOINT_PRESETS } from '@/lib/design/breakpoints'
import { pageHtmlPath, parsePageIdFromPath } from '@/lib/design/pages'
import {
  appendVisualReferenceToPrompt,
  visualReferenceUserPromptBlock,
} from '@/lib/design/visualReference'
import { resolveOrchestrationDevice } from '@/lib/design/visualReferenceDevice'
import { orchestrationTextOnlyIdentityBlocks } from '@/lib/design/briefDesignDerivation'
import {
  type DesignBrief,
  composeOrchestrationUserPrompt,
  orchestrationFreshDesignIsolationBlock,
  resolveOrchestrationLocale,
  inferDesignBriefFromPrompt,
  mergeDesignBrief,
} from '@/lib/design/designBrief'
import {
  allocateNewDesignPageId,
  existingDesignPagesLayoutPromptBlock,
  newPageNameFromPrompt,
  orchestrationElementContextsBlock,
  referencePageHtmlExcerpt,
} from '@/lib/design/designExistingContext'
import {
  existingPageHtml,
  orchestrationElementContextsModifyBlock,
  rebuildPageModifyHtmlBlock,
  shouldPreserveExistingImagesOnModify,
} from '@/lib/design/designModifyPrompts'
import {
  layoutExistingPagesHints,
  layoutVarietyHints,
  validateLayoutPlan,
  fallbackLayoutPagesForBrief,
  clampLayoutPagesForVisualReference,
  layoutJsonFromPages,
} from '@/lib/design/orchestrationLayout'
import {
  loadExistingPrimaryPages,
  mergeOrchestrationLayoutWithExisting,
  mergeOrchestrationLayoutExclusiveVisualReference,
  seedOrchestrationFilesFromExisting,
} from '@/lib/design/designExistingContext'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'
import {
  assetPlanToFile,
  buildFallbackAssetPlan,
  executeOrchestrationAssetPlan,
  formatPreGeneratedAssetsBlock,
  parseAssetPlanFromModelText,
} from '@/lib/design/orchestrationAssets'
import { designBriefImageInstructionsBlock } from '@/lib/design/designImageBriefContext'
import { resolvePhotographyStyle } from '@/lib/design/designPhotographyStyle'
import { shouldRunDesignImageGen, getDesignImageGenBlockReason } from '@/lib/design/designImageGenAvailability.server'
import {
  generateDesignImagesFromOutput,
  mergeDesignFilesWithImages,
  stripImageTags,
  stripImageTagsFromDesignFiles,
} from '@/lib/design/designImageGen'
import { DESIGN_SPEC_MD, type DesignPageMeta } from '@/lib/design/types'
import { buildInterimOrchestrationSpecFile, buildTokensOnlySpecFile } from '@/lib/design/orchestrationCanvas'
import { parsePartialSinglePageHtml } from '@/lib/design/parsePartialPageHtml'
import { isOrchestrationPlaceholderHtml } from '@/lib/design/orchestrationFallbackHtml'
import {
  buildPlaceholderAssetFilesForHtml,
  designAssetReadyPathsFromExisting,
} from '@/lib/design/designAssetPlaceholders'
import {
  extractLargestHtmlDocumentFromModelText,
  isAcceptableOrchestrationPageHtml,
  isCompleteOrchestrationPageHtml,
  orchestrationPageHtmlIncompleteReason,
  prepareOrchestrationPageHtmlForPersist,
} from '@/lib/design/orchestrationHtmlQuality'
import {
  DESIGN_LAYOUT_PATH,
  DESIGN_TOKENS_PATH,
  extractJsonFromModelText,
  jsonFileFromModelResponse,
  layoutFromModelResponse,
  parseLayoutNavigationLinks,
  parseLayoutPages,
  parseOrchestrationHtmlFiles,
  selectOrchestrationHtmlForPage,
  synthesizeOrchestrationSpec,
  type OrchestrationLayoutPage,
} from '@/lib/design/orchestrationParse'

export type OrchestrationResult = {
  files: Array<{ path: string; content: string }>
}

export type OrchestrationElementContext = {
  skId: string
  tagName: string
  text?: string
}

export type OrchestrationOpts = {
  device?: DesignPreviewBreakpoint
  images?: VertexImagePart[]
  modelId?: string
  brief?: DesignBrief
  /** Archivos de diseño ya persistidos (para añadir páginas sin borrar). */
  existing?: ProjectFileRecord[]
  /** Crea exactamente una pantalla nueva (no reemplaza las existentes). */
  forceNewPage?: boolean
  /** Sustituye el diseño del proyecto (no conservar design.md/tokens/HTML previos). */
  replaceDesign?: boolean
  /** Regenera HTML de estas pantallas con spec/design.md (sin crear página nueva). */
  rebuildPageIds?: string[]
  /** Pantalla existente como referencia visual/HTML (p. ej. modificar con pin). */
  referencePageId?: string
  elementContexts?: OrchestrationElementContext[]
  /** Si true, planifica y genera assets [IMAGE:] (requiere Imagen habilitado en admin). */
  generateImages?: boolean
  /** Modelo de imagen Vertex (compositor); si falta, usa el del panel admin. */
  imageModelId?: string
  onToken?: (chunk: string) => void
  send?: (type: string, data: string) => void
  persistPartial?: (files: Array<{ path: string; content: string }>) => Promise<void>
  signal?: AbortSignal
}

function dedupeFilesByPath(
  files: Array<{ path: string; content: string }>,
): Array<{ path: string; content: string }> {
  const byPath = new Map<string, { path: string; content: string }>()
  for (const file of files) byPath.set(file.path, file)
  return [...byPath.values()]
}

function withVisualContext(prompt: string, images?: VertexImagePart[]): string {
  return appendVisualReferenceToPrompt(prompt, Boolean(images?.length))
}

/** Con captura adjunta, flash-lite suele ignorar layout/colores; subir a flash. */
export function resolveOrchestrationModelId(
  modelId: string,
  hasVisualReference: boolean,
): string {
  if (!hasVisualReference) return modelId
  if (modelId.includes('flash-lite')) return modelId.replace('flash-lite', 'flash')
  return modelId
}

function layoutJsonFromModelText(text: string): string {
  return layoutFromModelResponse(text).layoutJson
}

function resolveLayoutPages(
  layoutJson: string,
  brief: DesignBrief,
  visualProfile?: VisualBriefInference | null,
  opts?: { visualReferenceOnly?: boolean },
): { layoutJson: string; layoutPages: ReturnType<typeof parseLayoutPages> } {
  const preservedLinks = parseLayoutNavigationLinks(layoutJson)
  let pages = parseLayoutPages(layoutJson)
  if (!pages.length) {
    pages = fallbackLayoutPagesForBrief(brief, visualProfile, {
      visualReferenceOnly: opts?.visualReferenceOnly,
    })
    layoutJson = layoutJsonFromPages(pages, preservedLinks)
  }
  if (opts?.visualReferenceOnly) {
    pages = clampLayoutPagesForVisualReference(pages, true)
    layoutJson = layoutJsonFromPages(pages, preservedLinks)
  }
  return { layoutJson, layoutPages: pages }
}

async function resolveVisualProfileForOrchestration(opts: {
  orchestrationImages: VertexImagePart[]
  brief: DesignBrief
  modelId: string
  send?: (type: string, data: string) => void
}): Promise<VisualBriefInference | null> {
  if (!opts.orchestrationImages.length) return null
  opts.send?.('phase', 'visual-audit')
  const auditModel = opts.modelId.includes('flash-lite')
    ? opts.modelId.replace('flash-lite', 'flash')
    : opts.modelId
  let profile = await inferVisualBriefFromImages({
    images: opts.orchestrationImages,
    prompt: opts.brief.prompt,
    modelId: auditModel,
  })
  if (!profile) {
    profile = await inferVisualBriefFromImages({
      images: opts.orchestrationImages,
      prompt: opts.brief.prompt,
      modelId: 'gemini-2.5-flash',
    })
  }
  if (!profile) {
    opts.send?.('phase', 'visual-audit-failed')
    return null
  }
  return {
    ...profile,
    siteType: profile.siteType ?? siteTypeFromVisualTopology(profile.layoutTopology),
  }
}

function assertVisualProfileWhenRequired(
  orchestrationImages: VertexImagePart[],
  visualProfile: VisualBriefInference | null,
): void {
  if (!orchestrationImages.length) return
  if (!visualProfile) {
    throw new VisualAuditRequiredError()
  }
  if (!isVisualProfileActionable(visualProfile)) {
    throw new VisualAuditRequiredError(
      'La auditoría visual no extrajo colores ni estructura suficientes. Vuelve a adjuntar la captura.',
    )
  }
}

function finalizeDesignMdForVisualProfile(
  designMd: string,
  visualProfile: VisualBriefInference,
): { designMd: string; envelope: ReturnType<typeof envelopeFromDesignMd> } {
  const snapped = snapVisualColorsToDesignMd(designMd, visualProfile)
  const envelope = envelopeFromDesignMd(snapped)
  return { designMd: snapped, envelope }
}

const VISUAL_HTML_FIDELITY_MAX_RETRIES = 2

function buildVisualFidelityFailedPlaceholder(pageId: string, reasons: string[]): string {
  const list = reasons
    .map((r) => `<li>${r.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`)
    .join('')
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><title>Referencia visual — reintento</title></head>
<body class="min-h-screen bg-surface text-on-surface p-8 font-sans">
  <h1 class="text-headline-lg font-bold mb-4">No se pudo replicar la captura</h1>
  <p class="text-body-md text-on-surface-variant mb-4">Regenera con la misma imagen de referencia. El sistema detectó:</p>
  <ul class="list-disc pl-6 text-body-md space-y-2">${list}</ul>
  <p class="mt-6 text-label-sm text-on-surface-variant">page: ${pageId}</p>
</body>
</html>`
}

function layoutPageContext(page: { id: string; name?: string }): ReturnType<typeof parseLayoutPages> {
  return [
    {
      id: page.id,
      name: page.name ?? (page.id === 'home' ? 'Inicio' : page.id),
    },
  ]
}

function parsePageHtmlFiles(
  pageHtml: string,
  page: { id: string; name?: string },
  _layoutPages: ReturnType<typeof parseLayoutPages>,
  device: DesignPreviewBreakpoint,
): Array<{ path: string; content: string }> {
  const contextPages = layoutPageContext(page)
  let pageFiles = parseOrchestrationHtmlFiles(pageHtml, contextPages)
  if (pageFiles.length) return pageFiles

  const preset = DESIGN_BREAKPOINT_PRESETS[device]
  const partial = parsePartialSinglePageHtml(pageHtml, {
    id: page.id,
    name: page.name ?? (page.id === 'home' ? 'Inicio' : page.id),
    path: pageHtmlPath(page.id),
    width: preset.width,
    height: preset.height,
    media: 'html',
  })
  if (partial) {
    pageFiles = parseOrchestrationHtmlFiles(
      `\`\`\`html ${partial.path}\n${partial.content}\n\`\`\``,
      contextPages,
    )
  }
  return pageFiles
}

function pageHtmlCandidateFromModelResponse(
  pageHtml: string,
  page: { id: string; name?: string },
  layoutPages: ReturnType<typeof parseLayoutPages>,
  device: DesignPreviewBreakpoint,
  designMd?: string,
): { html: string; source: 'parsed' | 'raw' } {
  const parsed = parsePageHtmlFiles(pageHtml, page, layoutPages, device)
  const targetPath = pageHtmlPath(page.id)
  const file = parsed.find((f) => f.path === targetPath)
  if (file?.content?.trim()) {
    return {
      html: prepareOrchestrationPageHtmlForPersist(file.content, designMd),
      source: 'parsed',
    }
  }
  const largest = extractLargestHtmlDocumentFromModelText(pageHtml)
  if (largest?.trim()) {
    return {
      html: prepareOrchestrationPageHtmlForPersist(largest, designMd),
      source: 'parsed',
    }
  }
  return { html: prepareOrchestrationPageHtmlForPersist(pageHtml, designMd), source: 'raw' }
}

function fenceWrapPageHtml(path: string, content: string): string {
  return `\`\`\`html ${path}\n${content}\n\`\`\``
}

function resolvePageHtmlFiles(
  pageHtml: string,
  page: { id: string; name?: string },
  layoutPages: ReturnType<typeof parseLayoutPages>,
  device: DesignPreviewBreakpoint,
  tokensJson: string,
  designMd?: string,
): { files: Array<{ path: string; content: string }>; usedHtmlFallback: boolean } {
  let pageFiles = parsePageHtmlFiles(pageHtml, page, layoutPages, device)
  const selected = selectOrchestrationHtmlForPage(pageFiles, page.id)
  if (selected) {
    const prepared = prepareOrchestrationPageHtmlForPersist(selected.content, designMd)
    if (isAcceptableOrchestrationPageHtml(prepared)) {
      pageFiles = [{ path: selected.path, content: prepared }]
    } else {
      pageFiles = []
    }
  }
  if (!pageFiles.length) {
    const largest = extractLargestHtmlDocumentFromModelText(pageHtml)
    if (largest) {
      const prepared = prepareOrchestrationPageHtmlForPersist(largest, designMd)
      if (isAcceptableOrchestrationPageHtml(prepared)) {
        pageFiles = [{ path: pageHtmlPath(page.id), content: prepared }]
      }
    }
  }
  if (!pageFiles.length) {
    const direct = prepareOrchestrationPageHtmlForPersist(pageHtml, designMd)
    if (isAcceptableOrchestrationPageHtml(direct)) {
      console.info(
        `[orchestration] Persistiendo HTML del modelo (${direct.length} chars) para ${page.id}`,
      )
      pageFiles = [{ path: pageHtmlPath(page.id), content: direct }]
    }
  }
  if (!pageFiles.length && pageHtml.trim().length > 0) {
    const emergencySource = extractLargestHtmlDocumentFromModelText(pageHtml) ?? pageHtml
    const emergency = prepareOrchestrationPageHtmlForPersist(emergencySource, designMd)
    if (isAcceptableOrchestrationPageHtml(emergency)) {
      console.info(
        `[orchestration] Persistiendo HTML reparable del modelo (${emergency.length} chars) para ${page.id}`,
      )
      pageFiles = [{ path: pageHtmlPath(page.id), content: emergency }]
    }
  }
  if (pageFiles.length) {
    const cleaned = pageFiles.filter(
      (f) =>
        !isOrchestrationPlaceholderHtml(f.content) &&
        !isDesignPreviewPlaceholderHtml(f.content),
    )
    if (cleaned.length) {
      return { files: cleaned, usedHtmlFallback: false }
    }
  }
  const preparedForReason = prepareOrchestrationPageHtmlForPersist(
    extractLargestHtmlDocumentFromModelText(pageHtml) ?? pageHtml,
    designMd,
  )
  const reason = !pageHtml.trim()
    ? 'respuesta vacía del modelo'
    : !isAcceptableOrchestrationPageHtml(preparedForReason)
      ? `HTML no aceptable (${orchestrationPageHtmlIncompleteReason(preparedForReason)}; ${pageHtml.length} chars crudos)`
      : `sin bloque html parseable (${pageHtml.length} caracteres)`
  console.warn(
    `[orchestration] Sin HTML válido para ${page.id} (${reason}); no se persiste borrador genérico`,
  )
  return { files: [], usedHtmlFallback: true }
}

async function callOrchestrationText(
  prompt: string,
  opts: {
    systemInstruction: string
    modelId?: string
    images?: VertexImagePart[]
    responseMimeType?: string
    signal?: AbortSignal
  },
): Promise<string> {
  throwIfAborted(opts.signal)
  const enriched = withVisualContext(prompt, opts.images)

  return generateAgentPlatformText(enriched, {
    systemInstruction: opts.systemInstruction,
    model: opts.modelId,
    images: opts.images,
    responseMimeType: opts.responseMimeType,
    preferRealtime: true,
  })
}

export async function generateOrchestratedDesign(
  prompt: string,
  opts: OrchestrationOpts = {},
): Promise<OrchestrationResult> {
  // Con SSE (`send`) el panel necesita fases en vivo; Agent Studio devuelve todos los
  // eventos al final tras varias llamadas Vertex en bloque → el log se queda en
  // "Generando diseño web único..." mucho rato.
  // Con imágenes o referencia Stitch: siempre en proceso (auditoría visual + multimodal).
  const hasUserImages = Boolean(opts.images?.length)
  const hasStitchProject = Boolean(opts.brief?.stitchProjectId?.trim())
  const preferInProcess = Boolean(opts.send) || hasUserImages || hasStitchProject

  // Con imagen de referencia: siempre pipeline local (auditoría + validación de fidelidad).
  if (hasUserImages) {
    return runInProcessOrchestration(prompt, opts)
  }

  if (!preferInProcess && (await isDesignAgentStudioEnabled())) {
    try {
      return await runAgentStudioOrchestration(prompt, opts)
    } catch (agentErr) {
      console.warn(
        '[orchestration] Agent Studio falló; continuando en proceso local con Vertex',
        agentErr,
      )
    }
  }
  return runInProcessOrchestration(prompt, opts)
}

async function runAgentStudioOrchestration(
  prompt: string,
  opts: OrchestrationOpts,
): Promise<OrchestrationResult> {
  const {
    device = 'desktop',
    images,
    modelId,
    generateImages,
    onToken,
    send,
    persistPartial,
  } = opts

  const hasUserImagesEarly = Boolean(opts.images?.length)
  const promptInferred = inferDesignBriefFromPrompt(prompt)
  const brief = mergeDesignBrief(
    opts.brief ?? { prompt },
    hasUserImagesEarly ? { ...promptInferred, siteType: undefined } : promptInferred,
  )

  const allFiles: Array<{ path: string; content: string }> = []
  const accumulatedPaths = new Set<string>()
  const pushFiles = async (batch: Array<{ path: string; content: string }>) => {
    if (!batch.length) return
    for (const f of batch) accumulatedPaths.add(f.path)
    allFiles.push(...batch)
    await persistPartial?.(batch)
  }

  const orchestrationImages = mergeOrchestrationImageParts(
    images,
    resolveStitchReferenceForOrchestration(brief.stitchProjectId),
  )
  const hasVisualRef = orchestrationHasVisualReference(
    orchestrationImages,
    resolveStitchReferenceForOrchestration(brief.stitchProjectId),
  )
  const contentModelId = resolveOrchestrationModelId(
    modelId ?? getDesignGenModelId(),
    hasVisualRef,
  )
  let agentBrief = brief
  let visualProfile: VisualBriefInference | null = null
  if (orchestrationImages.length) {
    visualProfile = await resolveVisualProfileForOrchestration({
      orchestrationImages,
      brief,
      modelId: contentModelId,
      send,
    })
    if (visualProfile) {
      agentBrief = mergeVisualInferenceIntoBrief(brief, visualProfile)
    }
    assertVisualProfileWhenRequired(orchestrationImages, visualProfile)
  }

  const agentResult = await runDesignAgentOrchestration({
    brief: agentBrief,
    modelId,
    device,
    visualProfile: visualProfile ?? undefined,
  })

  for (const ev of agentResult.events) {
    if (ev.type === 'phase') send?.('phase', ev.data)
  }

  let agentDesignMd =
    opts.existing?.find((f) => f.path === DESIGN_SPEC_MD)?.content?.trim() ?? ''
  if (!agentDesignMd) {
    agentDesignMd = buildStitchStyleDesignMd(
      envelopeFromModelJson(agentResult.tokensJson),
      agentBrief,
    )
  }
  if (
    visualProfile &&
    (visualProfile.colorRoles || visualProfile.dominantColors?.length)
  ) {
    agentDesignMd = snapVisualColorsToDesignMd(agentDesignMd, visualProfile)
  }
  const tokensJson =
    visualProfile &&
    (visualProfile.colorRoles || visualProfile.dominantColors?.length)
      ? tokensJsonFromDesignMd(agentDesignMd)
      : agentResult.tokensJson
  const layoutJson = agentResult.layoutJson
  const htmlModelId = agentResult.modelId ?? contentModelId

  const tokenFile = { path: DESIGN_TOKENS_PATH, content: tokensJson }
  await pushFiles([tokenFile])

  const existingPrimaryPages = loadExistingPrimaryPages(opts.existing)

  const agentLayoutParsed = layoutFromModelResponse(layoutJson)
  const resolvedAgentLayout = agentLayoutParsed.pages.length
    ? { layoutJson: agentLayoutParsed.layoutJson, layoutPages: agentLayoutParsed.pages }
    : resolveLayoutPages(layoutJson, agentBrief, visualProfile, {
        visualReferenceOnly: Boolean(orchestrationImages.length),
      })
  const mergedLayout = mergeOrchestrationLayoutWithExisting(
    resolvedAgentLayout.layoutPages,
    existingPrimaryPages,
    agentLayoutParsed.navigationLinks,
  )
  const { layoutPages, pagesToBuild, layoutJson: mergedLayoutJson } = mergedLayout

  const layoutFile = { path: DESIGN_LAYOUT_PATH, content: mergedLayoutJson }
  const interimSpec = buildInterimOrchestrationSpecFile(
    mergedLayoutJson,
    tokensJson,
    device,
    existingPrimaryPages,
  )
  const layoutBatch = interimSpec
    ? [layoutFile, { path: interimSpec.path, content: interimSpec.content }]
    : [layoutFile]
  await pushFiles(layoutBatch)

  const assetPlan = parseAssetPlanFromModelText(agentResult.assetPlanJson)
  if (assetPlan) {
    await pushFiles([assetPlanToFile(assetPlan)])
  }

  const agentThemeCss = designMdThemeCssFile(agentDesignMd)
  await pushFiles([
    { path: DESIGN_SPEC_MD, content: agentDesignMd },
    ...(agentThemeCss ? [agentThemeCss] : []),
  ])

  const runImages = await shouldRunDesignImageGen(generateImages)

  const htmlOnly = await runOrchestrationHtmlPhase({
    brief: agentBrief,
    device,
    images: orchestrationImages,
    visualProfile,
    modelId: htmlModelId,
    tokensJson,
    designMd: agentDesignMd,
    layoutJson: mergedLayoutJson,
    layoutPages,
    pagesToBuild,
    existingPrimaryPages,
    preGeneratedAssetsBlock: '',
    generateImages: runImages,
    runImages,
    imageModelId: opts.imageModelId,
    styleReference: images?.[0] ? { mimeType: images[0].mimeType, data: images[0].data } : undefined,
    accumulatedPaths,
    onToken,
    send,
    pushFiles,
  })

  const specFile = synthesizeOrchestrationSpec({
    tokensJson,
    layoutJson: mergedLayoutJson,
    device,
    htmlFiles: htmlOnly,
    existingPrimaryPages,
  })
  if (specFile) await pushFiles([specFile])

  await runOrchestrationHtmlPlaceholderAssets({
    htmlFiles: htmlOnly,
    accumulatedPaths,
    pushFiles,
  })

  return { files: dedupeFilesByPath(allFiles) }
}

type HtmlPhaseParams = {
  brief: DesignBrief
  device: DesignPreviewBreakpoint
  images?: VertexImagePart[]
  visualProfile?: VisualBriefInference | null
  modelId: string
  tokensJson: string
  designMd?: string
  stitchPromptBlocks?: string[]
  layoutJson: string
  layoutPages: ReturnType<typeof parseLayoutPages>
  /** Solo estas pantallas reciben HTML nuevo (las existentes se conservan). */
  pagesToBuild: ReturnType<typeof parseLayoutPages>
  existingPrimaryPages: DesignPageMeta[]
  existingFiles?: ProjectFileRecord[]
  referencePageId?: string
  elementContexts?: OrchestrationElementContext[]
  preGeneratedAssetsBlock: string
  generateImages?: boolean
  /** Ya resuelto en fase layout (Vertex disponible + preferencia usuario). */
  runImages?: boolean
  imageModelId?: string
  /** Primera imagen de referencia — se pasa a Gemini como style reference para assets. */
  styleReference?: { mimeType: string; data: string }
  accumulatedPaths: Set<string>
  forceNewPage?: boolean
  rebuildPageIds?: string[]
  onToken?: (chunk: string) => void
  send?: (type: string, data: string) => void
  pushFiles: (batch: Array<{ path: string; content: string }>) => Promise<void>
  signal?: AbortSignal
}

type ThemePaletteDirection = {
  primary?: string
  secondary?: string
  tertiary?: string
  background?: string
  surface?: string
  text?: string
  rationale?: string
  styleName?: string
  visualStyle?: string
  typography?: {
    heading?: string
    body?: string
    mood?: string
  }
  layoutDirection?: string
  componentsDirection?: string
  imageryDirection?: string
}

function parseThemePaletteDirection(text: string): ThemePaletteDirection | null {
  const raw = text.trim()
  if (!raw) return null
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fenced ?? raw).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
    const hex = (k: string) => {
      const v = String(parsed[k] ?? '').trim()
      return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : undefined
    }
    const palette: ThemePaletteDirection = {
      primary: hex('primary'),
      secondary: hex('secondary'),
      tertiary: hex('tertiary'),
      background: hex('background'),
      surface: hex('surface'),
      text: hex('text'),
      rationale: String(parsed.rationale ?? '').trim() || undefined,
      styleName: String(parsed.styleName ?? '').trim() || undefined,
      visualStyle: String(parsed.visualStyle ?? '').trim() || undefined,
      layoutDirection: String(parsed.layoutDirection ?? '').trim() || undefined,
      componentsDirection: String(parsed.componentsDirection ?? '').trim() || undefined,
      imageryDirection: String(parsed.imageryDirection ?? '').trim() || undefined,
      typography:
        parsed.typography && typeof parsed.typography === 'object'
          ? {
              heading:
                String((parsed.typography as Record<string, unknown>).heading ?? '').trim() ||
                undefined,
              body:
                String((parsed.typography as Record<string, unknown>).body ?? '').trim() ||
                undefined,
              mood:
                String((parsed.typography as Record<string, unknown>).mood ?? '').trim() ||
                undefined,
            }
          : undefined,
    }
    if (!palette.primary && !palette.secondary && !palette.tertiary) return null
    return palette
  } catch {
    return null
  }
}

async function runThemePaletteDirectionPhase(opts: {
  brief: DesignBrief
  modelId: string
  send?: (type: string, data: string) => void
  pushFiles: (batch: Array<{ path: string; content: string }>) => Promise<void>
  signal?: AbortSignal
}): Promise<ThemePaletteDirection | null> {
  const { brief, modelId, send, pushFiles, signal } = opts
  // Evita romper tests que mockean fases cerradas.
  if (process.env.NODE_ENV === 'test') return null
  throwIfAborted(signal)
  send?.('phase', 'theme-palette-direction')
  const text = await callOrchestrationText(
    `Define una paleta elegante para una web según esta temática del usuario:

${brief.prompt}`,
    {
      systemInstruction: `Eres director de color para UI web.
Responde SOLO JSON válido:
{
  "styleName": "2-5 palabras",
  "visualStyle": "dirección visual en 1 frase",
  "primary": "#RRGGBB",
  "secondary": "#RRGGBB",
  "tertiary": "#RRGGBB",
  "background": "#RRGGBB",
  "surface": "#RRGGBB",
  "text": "#RRGGBB",
  "typography": {
    "heading": "Google Font sugerida",
    "body": "Google Font sugerida",
    "mood": "tono tipográfico"
  },
  "layoutDirection": "estructura orientativa por secciones",
  "componentsDirection": "estilo de botones/cards/inputs",
  "imageryDirection": "dirección fotográfica/ilustración",
  "rationale": "1 frase"
}
Reglas:
- Paleta elegante y coherente entre sí.
- Evita defaults genéricos SaaS (azul/morado típico) salvo que el prompt lo pida.
- Contraste legible text/background.`,
      modelId,
      responseMimeType: 'application/json',
      signal,
    },
  )
  const palette = parseThemePaletteDirection(text)
  if (!palette) return null
  await pushFiles([
    { path: 'spec/theme-palette-direction.json', content: JSON.stringify(palette, null, 2) },
  ])
  return palette
}

/** Planifica y genera assets Imagen antes del HTML (cuando el usuario activa el icono de imagen). */
async function runOrchestrationAssetPhases(opts: {
  brief: DesignBrief
  tokensJson: string
  designMd?: string
  layoutJson: string
  modelId: string
  images?: VertexImagePart[]
  imageModelId?: string
  send?: (type: string, data: string) => void
  pushFiles: (batch: Array<{ path: string; content: string }>) => Promise<void>
  accumulatedPaths: Set<string>
  signal?: AbortSignal
}): Promise<string> {
  const {
    brief,
    tokensJson,
    designMd,
    layoutJson,
    modelId,
    images,
    send,
    pushFiles,
    accumulatedPaths,
    signal,
  } = opts

  throwIfAborted(signal)
  send?.('phase', 'asset-planning')
  const planPrompt = composeOrchestrationUserPrompt(brief, [
    ...(designMd?.trim()
      ? [`## spec/design.md\n${designMdExcerpt(designMd)}`]
      : []),
    `## Tokens\n${tokensJson}`,
    `## Layout\n${layoutJson}`,
  ])
  const planText = await callOrchestrationText(planPrompt, {
    systemInstruction: assetPlannerSystemInstruction({
      hasVisualReference: Boolean(images?.length),
    }),
    modelId,
    images,
    responseMimeType: 'application/json',
    signal,
  })
  let plan = parseAssetPlanFromModelText(planText)
  if (!plan?.assets.length) {
    plan = buildFallbackAssetPlan(brief)
    console.warn('[orchestration] Plan de assets vacío; usando plan por defecto del brief')
  }
  await pushFiles([assetPlanToFile(plan)])
  if (!plan.assets.length) return ''

  send?.('phase', 'asset-generation')
  const photographyStyle = resolvePhotographyStyle({ designMd, brief })
  const generated = await executeOrchestrationAssetPlan(plan, {
    send,
    photographyStyle,
    imageModelId: opts.imageModelId,
    onImageReady: async (img) => {
      accumulatedPaths.add(img.path)
      await pushFiles([{ path: img.path, content: img.content }])
    },
  })
  if (!generated.length) {
    send?.('phase', 'images-failed')
  }
  return formatPreGeneratedAssetsBlock(generated)
}

async function runDesignMdPhase(opts: {
  brief: DesignBrief
  baseUserPrompt: string
  modelId: string
  device: DesignPreviewBreakpoint
  images?: VertexImagePart[]
  visualProfile?: VisualBriefInference | null
  existingPrimaryPages?: DesignPageMeta[]
  send?: (type: string, data: string) => void
  pushFiles: (batch: Array<{ path: string; content: string }>) => Promise<void>
  signal?: AbortSignal
}): Promise<{ designMd: string; tokensJson: string }> {
  const {
    brief,
    baseUserPrompt,
    modelId,
    device,
    images,
    visualProfile,
    existingPrimaryPages,
    send,
    pushFiles,
    signal,
  } = opts

  throwIfAborted(signal)

  const callDesignMdText: Parameters<typeof runSequentialDesignMdBuild>[0]['callText'] = (
    prompt,
    callOpts,
  ) =>
    callOrchestrationText(prompt, {
      systemInstruction: callOpts.systemInstruction,
      modelId: callOpts.modelId,
      images: callOpts.images as VertexImagePart[] | undefined,
      signal: callOpts.signal,
    })

  const designMdBuildOpts = {
    brief,
    baseUserPrompt,
    modelId,
    images,
    visualProfile,
    signal,
    send,
    callText: callDesignMdText,
    onStepComplete: async (partialMd: string) => {
      const mdForStream = visualProfile
        ? snapVisualColorsToDesignMd(partialMd, visualProfile)
        : partialMd
      const partialTokens = tokensJsonFromDesignMd(mdForStream)
      const env = envelopeFromDesignMd(mdForStream)
      if (!orchestrationEnvelopeHasContent(env)) return
      const interim = buildTokensOnlySpecFile(partialTokens, device, existingPrimaryPages)
      await pushFiles([
        { path: DESIGN_SPEC_MD, content: mdForStream },
        { path: DESIGN_TOKENS_PATH, content: partialTokens },
        { path: interim.path, content: interim.content },
      ])
    },
  }

  const useMonolithicDesignMd =
    preferMonolithicDesignMd() || isStitchParityEnabled(modelId)

  const resolved = useMonolithicDesignMd
    ? await runMonolithicDesignMdBuild(designMdBuildOpts)
    : await runSequentialDesignMdBuild(designMdBuildOpts)

  if (resolved.source === 'brief-fallback') {
    console.warn(
      '[orchestration] design.md incompleto; plantilla final desde el brief',
    )
  } else if (resolved.source === 'model-json') {
    console.warn('[orchestration] design.md generado desde JSON de respaldo del modelo')
  }

  let { designMd, envelope } = resolved

  if (visualProfile) {
    const finalized = finalizeDesignMdForVisualProfile(designMd, visualProfile)
    designMd = finalized.designMd
    envelope = finalized.envelope
  }

  if (!orchestrationEnvelopeHasContent(envelope)) {
    envelope = mergeOrchestrationEnvelopes(envelope, envelopeFromModelJson(designMd))
  }

  if (!images?.length) {
    const aligned = alignDesignMdColorsToBrief(designMd, brief)
    if (aligned !== designMd) {
      designMd = aligned
      envelope = envelopeFromDesignMd(designMd) ?? envelope
      console.warn('[orchestration] design.md: paleta alineada al brief (modelo genérico corregido)')
      send?.('phase', 'design-md:brief-palette-align')
    }
  }

  let tokensJson = envelopeToTokensJson(envelope)
  const interim = buildTokensOnlySpecFile(tokensJson, device, existingPrimaryPages)
  const themeCss = isStitchParityEnabled(modelId) ? null : designMdThemeCssFile(designMd)
  await pushFiles([
    { path: DESIGN_SPEC_MD, content: designMd },
    { path: DESIGN_TOKENS_PATH, content: tokensJson },
    { path: interim.path, content: interim.content },
    ...(themeCss ? [themeCss] : []),
  ])
  send?.('phase', 'design-md-ready')

  const needsTokenReview = !designMdIsRichEnough(designMd)

  if (needsTokenReview) {
    send?.('phase', 'tokens-review')
    const reviewPrompt = composeOrchestrationUserPrompt(brief, [
      `## spec/design.md (fuente de verdad — no reescribas el markdown, solo valida tokens JSON)\n${designMdExcerpt(designMd)}`,
      `## Tokens derivados del frontmatter\n${tokensJson}`,
    ])
    const reviewText = await callOrchestrationText(reviewPrompt, {
      systemInstruction: tokensReviewSystemInstruction(),
      modelId,
      images,
      responseMimeType: 'application/json',
      signal,
    })
    envelope = mergeOrchestrationEnvelopes(envelope, envelopeFromModelJson(reviewText))
    if (visualProfile) {
      const finalized = finalizeDesignMdForVisualProfile(
        buildStitchStyleDesignMd(envelope, brief),
        visualProfile,
      )
      designMd = finalized.designMd
      envelope = finalized.envelope
    }
    tokensJson = envelopeToTokensJson(envelope)
  }

  if (!images?.length) {
    const aligned = alignDesignMdColorsToBrief(designMd, brief)
    if (aligned !== designMd) {
      designMd = aligned
      envelope = envelopeFromDesignMd(designMd) ?? envelope
      tokensJson = envelopeToTokensJson(envelope)
      send?.('phase', 'design-md:brief-palette-align')
    }
  }

  const reviewedInterim = buildTokensOnlySpecFile(tokensJson, device, existingPrimaryPages)
  await pushFiles([
    { path: DESIGN_SPEC_MD, content: designMd },
    { path: DESIGN_TOKENS_PATH, content: tokensJson },
    { path: reviewedInterim.path, content: reviewedInterim.content },
  ])

  return { designMd, tokensJson }
}

async function runTokenPhases(opts: {
  brief: DesignBrief
  baseUserPrompt: string
  modelId: string
  device: DesignPreviewBreakpoint
  images?: VertexImagePart[]
  visualProfile?: VisualBriefInference | null
  existingPrimaryPages?: DesignPageMeta[]
  existing?: ProjectFileRecord[]
  forceNewPage?: boolean
  rebuildPageIds?: string[]
  replaceDesign?: boolean
  /** design.md importado de Stitch — omite generación secuencial. */
  stitchDesignMd?: string
  send?: (type: string, data: string) => void
  pushFiles: (batch: Array<{ path: string; content: string }>) => Promise<void>
  signal?: AbortSignal
}): Promise<{ tokensJson: string; designMd: string }> {
  const importedMd = opts.stitchDesignMd?.trim()
  if (importedMd) {
    const tokensJson = tokensJsonFromDesignMd(importedMd)
    const interim = buildTokensOnlySpecFile(
      tokensJson,
      opts.device,
      opts.existingPrimaryPages ?? [],
    )
    const themeCss = designMdThemeCssFile(importedMd)
    await opts.pushFiles([
      { path: DESIGN_SPEC_MD, content: importedMd },
      { path: DESIGN_TOKENS_PATH, content: tokensJson },
      { path: interim.path, content: interim.content },
      ...(themeCss ? [themeCss] : []),
    ])
    opts.send?.('phase', 'design-md-ready')
    return { designMd: importedMd, tokensJson }
  }

  const existingFiles = opts.existing
  // Con captura adjunta hay que regenerar design.md/tokens (no heredar morado/landing previo).
  const preserveVisualSystem =
    !opts.replaceDesign &&
    !opts.images?.length &&
    Boolean(opts.forceNewPage || opts.rebuildPageIds?.length) &&
    Boolean(existingFiles?.length)
  if (preserveVisualSystem && existingFiles) {
    const designMd = existingFiles.find((f) => f.path === DESIGN_SPEC_MD)?.content?.trim() ?? ''
    const tokensJson =
      existingFiles.find((f) => f.path === DESIGN_TOKENS_PATH)?.content?.trim() ?? ''
    if (designMd && tokensJson) {
      opts.send?.('phase', 'design-md-ready')
      return { designMd, tokensJson }
    }
  }
  return runDesignMdPhase(opts)
}

type LayoutContentParams = {
  brief: DesignBrief
  device: DesignPreviewBreakpoint
  images?: VertexImagePart[]
  visualProfile?: VisualBriefInference | null
  stitchRef?: StitchReferenceBundle | null
  modelId: string
  tokensJson: string
  designMd?: string
  stitchPromptBlocks?: string[]
  existingPrimaryPages: DesignPageMeta[]
  existingFiles?: ProjectFileRecord[]
  forceNewPage?: boolean
  rebuildPageIds?: string[]
  referencePageId?: string
  elementContexts?: OrchestrationElementContext[]
  generateImages?: boolean
  imageModelId?: string
  onToken?: (chunk: string) => void
  send?: (type: string, data: string) => void
  pushFiles: (batch: Array<{ path: string; content: string }>) => Promise<void>
  signal?: AbortSignal
}

function layoutPagesFromIds(
  pageIds: string[],
  existingPrimaryPages: DesignPageMeta[],
): ReturnType<typeof parseLayoutPages> {
  return pageIds.map((id) => {
    const existing = existingPrimaryPages.find((p) => p.id === id)
    return { id, name: existing?.name ?? (id === 'home' ? 'Inicio' : id) }
  })
}

function applyRequestedPageCountToLayout(opts: {
  mergedLayout: ReturnType<typeof mergeOrchestrationLayoutWithExisting>
  requestedPageCount?: number
  hasVisualReference: boolean
}): ReturnType<typeof mergeOrchestrationLayoutWithExisting> {
  const requestedRaw = opts.requestedPageCount
  if (!requestedRaw || requestedRaw <= 0 || opts.hasVisualReference) return opts.mergedLayout
  const requested = Math.floor(requestedRaw)
  if (requested <= 0) return opts.mergedLayout

  const current = opts.mergedLayout.layoutPages
  if (current.length === requested) return opts.mergedLayout

  if (current.length > requested) {
    const keep = current.slice(0, requested)
    const keepIds = new Set(keep.map((p) => p.id))
    const links = parseLayoutNavigationLinks(opts.mergedLayout.layoutJson)
    return {
      ...opts.mergedLayout,
      layoutPages: keep,
      pagesToBuild: opts.mergedLayout.pagesToBuild.filter((p) => keepIds.has(p.id)),
      layoutJson: layoutJsonFromPages(keep, links),
    }
  }

  const expanded = [...current]
  let n = 2
  while (expanded.length < requested) {
    let id = `page-${n}`
    while (expanded.some((p) => p.id === id)) {
      n += 1
      id = `page-${n}`
    }
    expanded.push({
      id,
      name: `Página ${expanded.length + 1}`,
      layoutStrategy: 'supporting-content',
      sections: [
        { type: 'navigation', style: 'minimal' },
        { type: 'content', composition: 'single-column' },
        { type: 'footer', style: 'compact' },
      ],
    })
    n += 1
  }

  const oldBuilt = new Set(opts.mergedLayout.pagesToBuild.map((p) => p.id))
  const expandedToBuild = expanded.filter((p) => oldBuilt.has(p.id) || !current.some((c) => c.id === p.id))
  const links = parseLayoutNavigationLinks(opts.mergedLayout.layoutJson)
  return {
    ...opts.mergedLayout,
    layoutPages: expanded,
    pagesToBuild: expandedToBuild,
    layoutJson: layoutJsonFromPages(expanded, links),
  }
}

async function runOrchestrationLayoutAndContent(params: LayoutContentParams): Promise<void> {
  const {
    brief,
    device,
    images,
    modelId,
    tokensJson,
    designMd,
    generateImages,
    imageModelId,
    onToken,
    send,
    pushFiles: pushFilesOuter,
    existingPrimaryPages: existingPrimaryPagesParam,
    forceNewPage,
    rebuildPageIds,
    signal,
  } = params
  let effectiveDesignMd = designMd?.trim() ?? ''
  if (!effectiveDesignMd || !designMdIsRichEnough(effectiveDesignMd)) {
    effectiveDesignMd = buildStitchStyleDesignMd(envelopeFromModelJson(tokensJson), brief)
  }
  const existingPrimaryPages = existingPrimaryPagesParam ?? []

  throwIfAborted(signal)

  const accumulatedPaths = designAssetReadyPathsFromExisting(params.existingFiles)
  const pushFiles = async (batch: Array<{ path: string; content: string }>) => {
    for (const f of batch) accumulatedPaths.add(f.path)
    await pushFilesOuter(batch)
  }

  let layoutPages: ReturnType<typeof parseLayoutPages>
  let pagesToBuild: ReturnType<typeof parseLayoutPages>
  let layoutJson: string

  if (rebuildPageIds?.length) {
    const toRebuild = layoutPagesFromIds(rebuildPageIds, existingPrimaryPages)
    const mergedLayout = mergeOrchestrationLayoutWithExisting(toRebuild, existingPrimaryPages)
    layoutPages = mergedLayout.layoutPages
    pagesToBuild = toRebuild
    layoutJson = mergedLayout.layoutJson
    send?.('phase', 'layout-planning')
  } else if (forceNewPage) {
    const newId = allocateNewDesignPageId(existingPrimaryPages)
    const newName = newPageNameFromPrompt(brief.prompt)
    const mergedLayout = mergeOrchestrationLayoutWithExisting(
      [{ id: newId, name: newName }],
      existingPrimaryPages,
    )
    layoutPages = mergedLayout.layoutPages
    pagesToBuild = mergedLayout.pagesToBuild
    layoutJson = mergedLayout.layoutJson
    send?.('phase', `page:${newId}:1/1`)
  } else {
    const hasVisualReference = orchestrationHasVisualReference(images, params.stitchRef)
    const visualProfile = params.visualProfile ?? null

    if (
      visualProfile &&
      (isVisualProfileActionable(visualProfile) || hasVisualReference)
    ) {
      const auditPages = layoutPagesFromVisualProfile(visualProfile)
      layoutJson = layoutJsonFromPages(auditPages)
      const mergedFromAudit =
        hasVisualReference || params.replaceDesign
          ? mergeOrchestrationLayoutExclusiveVisualReference(auditPages)
          : mergeOrchestrationLayoutWithExisting(auditPages, existingPrimaryPages)
      layoutPages = mergedFromAudit.layoutPages
      pagesToBuild = mergedFromAudit.pagesToBuild
      send?.('phase', 'layout-from-visual-audit')
    } else {
    send?.('phase', 'layout-planning')
    const stitchLayoutHints = stitchLayoutParityHints(params.stitchRef?.referenceHtml)
    const layoutPromptBase = composeOrchestrationUserPrompt(brief, [
      ...orchestrationTextOnlyIdentityBlocks(brief, hasVisualReference),
      ...(hasVisualReference ? [visualReferenceUserPromptBlock()] : []),
      ...(visualProfile ? [visualAuditPromptBlock(visualProfile)] : []),
      ...(params.stitchPromptBlocks ?? []),
      ...(stitchLayoutHints ? [stitchLayoutHints] : []),
      ...(effectiveDesignMd.trim()
        ? [`## spec/design.md\n${designMdExcerpt(effectiveDesignMd)}`]
        : []),
      layoutVarietyHints(tokensJson, brief, { hasVisualReference, visualProfile }),
      layoutExistingPagesHints(existingPrimaryPages),
      `Tokens:\n${tokensJson}`,
    ])
    let layoutText = await callOrchestrationText(layoutPromptBase, {
      systemInstruction: layoutOrchestratorSystemInstruction(device, {
        hasVisualReference,
        requestedPageCount: brief.requestedPageCount,
      }),
      modelId,
      images,
      responseMimeType: 'application/json',
      signal,
    })

    const layoutParsed = layoutFromModelResponse(layoutText)
    let layoutJsonCandidate = layoutParsed.layoutJson
    let initialPages = layoutParsed.pages
    let layoutNavigationLinks = layoutParsed.navigationLinks
    let layoutNeedsFallback = initialPages.length === 0

    if (initialPages.length === 0) {
      console.warn(
        '[orchestration] Layout del modelo sin páginas parseables; usando plantilla de respaldo',
      )
    } else {
      let layoutValidation = validateLayoutPlan(layoutJsonCandidate, tokensJson, {
        hasVisualReference,
        stitchReferenceHtml: params.stitchRef?.referenceHtml,
        visualProfile,
      })
      if (!layoutValidation.ok) {
        console.warn('[orchestration] Layout genérico, reintentando fase 2:', layoutValidation.reason)
        layoutText = await callOrchestrationText(
          `${layoutPromptBase}\n\n## Corrección obligatoria\n${layoutValidation.reason}. Propón estructura distinta.`,
          {
            systemInstruction: layoutOrchestratorSystemInstruction(device, {
              hasVisualReference,
              requestedPageCount: brief.requestedPageCount,
            }),
            modelId,
            images,
            responseMimeType: 'application/json',
            signal,
          },
        )
        const retriedLayout = layoutFromModelResponse(layoutText)
        layoutJsonCandidate = retriedLayout.layoutJson
        initialPages = retriedLayout.pages
        layoutNavigationLinks = retriedLayout.navigationLinks
        layoutValidation = validateLayoutPlan(layoutJsonCandidate, tokensJson, {
          hasVisualReference,
          stitchReferenceHtml: params.stitchRef?.referenceHtml,
          visualProfile,
        })
        if (!layoutValidation.ok) {
          console.warn(
            '[orchestration] Layout sigue genérico tras reintento:',
            layoutValidation.reason,
          )
          layoutNeedsFallback = true
        }
      }
    }

    if (layoutNeedsFallback && hasVisualReference) {
      const fallbackPages = visualProfile?.sectionTypes?.length
        ? layoutPagesFromVisualProfile(visualProfile)
        : fallbackLayoutPagesForBrief(brief, visualProfile, { visualReferenceOnly: true })
      layoutJsonCandidate = layoutJsonFromPages(fallbackPages, layoutNavigationLinks)
      console.warn(
        '[orchestration] Layout sustituido por secciones de auditoría visual (sin plantilla genérica)',
      )
    }

    const resolvedLayout = resolveLayoutPages(layoutJsonCandidate, brief, visualProfile, {
      visualReferenceOnly: hasVisualReference,
    })
    let mergedLayout = mergeOrchestrationLayoutWithExisting(
      resolvedLayout.layoutPages,
      existingPrimaryPages,
      layoutNavigationLinks,
    )
    mergedLayout = applyRequestedPageCountToLayout({
      mergedLayout,
      requestedPageCount: brief.requestedPageCount,
      hasVisualReference,
    })
    layoutPages = mergedLayout.layoutPages
    pagesToBuild = mergedLayout.pagesToBuild
    layoutJson = mergedLayout.layoutJson

    if (!pagesToBuild.length && existingPrimaryPages.length) {
      const fallbackNovel = fallbackLayoutPagesForBrief(brief, visualProfile, {
        visualReferenceOnly: hasVisualReference,
      }).filter((p) => !existingPrimaryPages.some((e) => e.id === p.id))
      if (fallbackNovel.length) {
        const retry = mergeOrchestrationLayoutWithExisting(fallbackNovel, existingPrimaryPages)
        layoutPages = retry.layoutPages
        pagesToBuild = retry.pagesToBuild
        layoutJson = retry.layoutJson
      }
    }
    }
  }

  const layoutFile = {
    path: DESIGN_LAYOUT_PATH,
    content: layoutJson,
  }

  const interimSpec = buildInterimOrchestrationSpecFile(
    layoutJson,
    tokensJson,
    device,
    existingPrimaryPages,
  )
  const layoutBatch = interimSpec
    ? [layoutFile, { path: interimSpec.path, content: interimSpec.content }]
    : [layoutFile]
  await pushFiles(layoutBatch)

  const runImages = await shouldRunDesignImageGen(generateImages)
  const preGeneratedAssetsBlock = ''
  if (generateImages && !runImages) {
    const reason = (await getDesignImageGenBlockReason()) ?? 'vertex'
    send?.('phase', `images-unavailable:${reason}`)
    console.warn(
      `[orchestration] Generación de imágenes solicitada pero no disponible (${reason})`,
    )
  }

  throwIfAborted(signal)

  const htmlOnly = await runOrchestrationHtmlPhase({
    brief,
    device,
    images,
    visualProfile: params.visualProfile,
    modelId,
    tokensJson,
    designMd: effectiveDesignMd,
    stitchPromptBlocks: params.stitchPromptBlocks,
    layoutJson,
    layoutPages,
    pagesToBuild,
    existingPrimaryPages,
    existingFiles: params.existingFiles,
    referencePageId: params.referencePageId,
    elementContexts: params.elementContexts,
    preGeneratedAssetsBlock,
    generateImages: runImages,
    runImages,
    imageModelId,
    styleReference: images?.[0] ? { mimeType: images[0].mimeType, data: images[0].data } : undefined,
    accumulatedPaths,
    forceNewPage,
    rebuildPageIds,
    onToken,
    send,
    pushFiles,
    signal,
  })

  const specFile = synthesizeOrchestrationSpec({
    tokensJson,
    layoutJson,
    device,
    htmlFiles: htmlOnly,
    existingPrimaryPages,
  })
  if (specFile) {
    await pushFiles([specFile])
  } else {
    console.warn(
      '[orchestration] No se pudo sintetizar spec/design.json (sin páginas en layout ni HTML)',
    )
  }

  try {
    await runOrchestrationHtmlPlaceholderAssets({
      htmlFiles: htmlOnly,
      accumulatedPaths,
      pushFiles,
    })
  } catch (assetsErr) {
    if (signal?.aborted) {
      const placeholders = buildPlaceholderAssetFilesForHtml(
        htmlOnly.filter((f) => f.path.endsWith('.html')),
        accumulatedPaths,
      )
      if (placeholders.length) {
        try {
          await pushFiles(placeholders)
        } catch {
          /* cliente desconectado */
        }
      }
    } else {
      throw assetsErr
    }
  }
}

/** Placeholders finales por si algún <img> quedó sin archivo (la generación va por pantalla). */
async function runOrchestrationHtmlPlaceholderAssets(opts: {
  htmlFiles: Array<{ path: string; content: string }>
  accumulatedPaths: Set<string>
  pushFiles: (batch: Array<{ path: string; content: string }>) => Promise<void>
}): Promise<void> {
  const htmlPages = opts.htmlFiles.filter((f) => f.path.endsWith('.html'))
  if (!htmlPages.length) return

  const placeholders = buildPlaceholderAssetFilesForHtml(htmlPages, opts.accumulatedPaths)
  if (placeholders.length) {
    await opts.pushFiles(placeholders)
  }
}

/** Genera assets Imagen justo después del HTML de una pantalla. */
async function runOrchestrationPageImageAssets(opts: {
  page: OrchestrationLayoutPage
  pageFiles: Array<{ path: string; content: string }>
  pageProgress: string
  designMd?: string
  brief: DesignBrief
  imageModelId?: string
  accumulatedPaths: Set<string>
  /** Primera imagen de referencia del usuario — se usa como style reference para Gemini. */
  styleReference?: { mimeType: string; data: string }
  send?: (type: string, data: string) => void
  pushFiles: (batch: Array<{ path: string; content: string }>) => Promise<void>
}): Promise<void> {
  const {
    page,
    pageFiles,
    pageProgress,
    designMd,
    brief,
    imageModelId,
    accumulatedPaths,
    send,
    pushFiles,
  } = opts
  const htmlPages = pageFiles.filter((f) => f.path.endsWith('.html'))
  if (!htmlPages.length) return

  const placeholders = buildPlaceholderAssetFilesForHtml(htmlPages, accumulatedPaths)
  if (placeholders.length) {
    await pushFiles(placeholders)
  }

  const photographyStyle = resolvePhotographyStyle({ designMd, brief })
  send?.('phase', `page-assets:${page.id}:${pageProgress}`)

  for (const htmlFile of htmlPages) {
    try {
      const generatedImages = await generateDesignImagesFromOutput([htmlFile.content], send, {
        htmlFiles: [htmlFile],
        photographyStyle,
        imageModelId,
        brief,
        styleReference: opts.styleReference,
        emitBatchPhase: false,
        pageId: page.id,
        pageProgress,
      })
      const merged = mergeDesignFilesWithImages(
        stripImageTagsFromDesignFiles([htmlFile]),
        generatedImages,
      )
      if (merged.length) await pushFiles(merged)
    } catch (imgErr) {
      console.warn(`[orchestration] Imágenes fallaron para ${page.id}`, imgErr)
    }
  }
}

async function runOrchestrationHtmlPhase(params: HtmlPhaseParams): Promise<
  Array<{ path: string; content: string }>
> {
  const {
    brief,
    device,
    images,
    modelId,
    tokensJson,
    designMd,
    layoutPages,
    pagesToBuild: pagesToBuildParam,
    preGeneratedAssetsBlock,
    generateImages,
    runImages: runImagesParam,
    imageModelId,
    accumulatedPaths,
    onToken,
    send,
    pushFiles,
    signal,
  } = params

  const runImages = runImagesParam ?? (await shouldRunDesignImageGen(generateImages))

  throwIfAborted(signal)
  send?.('phase', 'content-generation')
  const hasExistingScreens = params.existingPrimaryPages.length > 0
  const pagesToBuild =
    pagesToBuildParam.length > 0
      ? pagesToBuildParam
      : hasExistingScreens
        ? []
        : layoutPages.length > 0
          ? layoutPages
          : [{ id: 'home', name: 'Inicio' }]
  const htmlOnly: Array<{ path: string; content: string }> = []

  if (!pagesToBuild.length) {
    return htmlOnly
  }

  const hasVisualReference = Boolean(images?.length)
  const preferIncremental = preferIncrementalOrchestrationHtml(
    { send },
    modelId,
    params.visualProfile ?? null,
  )
  send?.(
    'phase',
    preferIncremental ? 'html-build:incremental' : 'html-build:monolith',
  )

  const rebuildSet = new Set(params.rebuildPageIds ?? [])
  const isRebuild = rebuildSet.size > 0

  for (let i = 0; i < pagesToBuild.length; i++) {
    throwIfAborted(signal)
    const page = pagesToBuild[i]!
    const progress = `${i + 1}/${pagesToBuild.length}`
    send?.('phase', `page:${page.id}:${progress}`)

    const pageExistingHtml = existingPageHtml(params.existingFiles, page.id)
    const preserveExistingImages = shouldPreserveExistingImagesOnModify({
      userPrompt: brief.prompt,
      generateImages: runImages,
      existingHtml: pageExistingHtml,
      page: { id: page.id },
      existingFiles: params.existingFiles,
    })
    const includeReferenceExcerpt = Boolean(
      params.referencePageId &&
      params.referencePageId !== page.id &&
      !rebuildSet.has(params.referencePageId),
    )

    try {
      await buildOrchestrationPageHtml({
        page,
        preferIncremental,
        brief,
        designMd,
        tokensJson,
        layoutPages,
        device,
        modelId,
        images,
        visualProfile: params.visualProfile,
        signal,
        send,
        pushFiles,
        onToken,
        generateImages,
        runImages,
        preserveExistingImages,
        imageModelId,
        accumulatedPaths,
        pageProgress: progress,
        htmlOnly,
        upsertHtmlInBatch: (files) => {
          for (const f of files.filter((file) => file.path.endsWith('.html'))) {
            const idx = htmlOnly.findIndex((h) => h.path === f.path)
            if (idx >= 0) htmlOnly[idx] = f
            else htmlOnly.push(f)
          }
        },
        extraPromptBlocks: [
          ...orchestrationTextOnlyIdentityBlocks(brief, hasVisualReference),
          ...(images?.length ? [visualReferenceUserPromptBlock()] : []),
          ...(params.visualProfile
            ? [
                visualAuditPromptBlock(params.visualProfile),
                visualReferenceLayoutHintsFromProfile(params.visualProfile),
                visualReferenceHtmlStructureBlock(params.visualProfile),
                ...(params.visualProfile.colorRoles
                  ? [visualReferenceBadgeHtmlBlock(params.visualProfile.colorRoles)]
                  : []),
              ]
            : []),
          ...(params.stitchPromptBlocks ?? []),
          ...(generateImages && !preserveExistingImages
            ? [designBriefImageInstructionsBlock(brief, true)]
            : []),
          ...(!hasVisualReference || includeReferenceExcerpt
            ? [existingDesignPagesLayoutPromptBlock(params.existingPrimaryPages)]
            : []),
          ...(includeReferenceExcerpt
            ? [referencePageHtmlExcerpt(params.existingFiles, params.referencePageId ?? '')]
            : []),
          ...(isRebuild && pageExistingHtml
            ? [
                rebuildPageModifyHtmlBlock(page.id, pageExistingHtml, brief.prompt, {
                  generateImages: runImages,
                }),
              ]
            : []),
          ...(params.elementContexts?.length
            ? isRebuild
              ? [orchestrationElementContextsModifyBlock(params.elementContexts)]
              : [orchestrationElementContextsBlock(params.elementContexts)]
            : []),
          params.forceNewPage
            ? `## Pantalla nueva obligatoria\nGenera HTML **completo** solo para id \`${page.id}\` en \`${pageHtmlPath(page.id)}\`. Las pantallas listadas arriba ya existen: no las reescribas ni las cites en el fence.`
            : '',
          `## Tokens JSON (confirmación; si difiere de spec/design.md, gana design.md)\n${tokensJson}`,
          `Layout (solo esta pantalla, id "${page.id}"):\n${JSON.stringify({ pages: [page] }, null, 2)}`,
          preGeneratedAssetsBlock,
          `Ruta de salida final: \`${pageHtmlPath(page.id)}\``,
        ].filter(Boolean),
        existingFiles: params.existingFiles,
      })
    } catch (pageErr) {
      if (isRequestAborted(signal, pageErr)) throw pageErr
      const message =
        pageErr instanceof Error ? pageErr.message : 'Error desconocido generando HTML'
      console.error(`[orchestration] Error en pantalla ${page.id}:`, pageErr)
      send?.('phase', `page:${page.id}:html-failed:${message.slice(0, 120)}`)
    }
  }

  if (htmlOnly.length < pagesToBuild.length) {
    const missing = pagesToBuild
      .filter((p) => !htmlOnly.some((h) => h.path === pageHtmlPath(p.id)))
      .map((p) => p.id)
    if (missing.length) {
      console.warn(
        `[orchestration] HTML incompleto: ${htmlOnly.length}/${pagesToBuild.length} pantallas; faltan: ${missing.join(', ')}`,
      )
      send?.('phase', `html-build:incomplete:${missing.join(',')}`)
    }
  }

  return htmlOnly
}

type BuildOrchestrationPageHtmlParams = {
  page: OrchestrationLayoutPage
  preferIncremental: boolean
  brief: DesignBrief
  designMd?: string
  tokensJson: string
  layoutPages: ReturnType<typeof parseLayoutPages>
  device: DesignPreviewBreakpoint
  modelId: string
  images?: VertexImagePart[]
  signal?: AbortSignal
  send?: (type: string, data: string) => void
  pushFiles: (batch: Array<{ path: string; content: string }>) => Promise<void>
  onToken?: (chunk: string) => void
  generateImages?: boolean
  runImages?: boolean
  preserveExistingImages?: boolean
  imageModelId?: string
  accumulatedPaths: Set<string>
  pageProgress: string
  htmlOnly: Array<{ path: string; content: string }>
  upsertHtmlInBatch: (files: Array<{ path: string; content: string }>) => void
  extraPromptBlocks: string[]
  existingFiles?: ProjectFileRecord[]
  visualProfile?: VisualBriefInference | null
}

async function buildOrchestrationPageHtml(params: BuildOrchestrationPageHtmlParams): Promise<void> {
  const {
    page,
    preferIncremental,
    brief,
    designMd,
    tokensJson,
    layoutPages,
    device,
    modelId,
    images,
    visualProfile,
    signal,
    send,
    pushFiles,
    onToken,
    generateImages,
    runImages,
    preserveExistingImages,
    imageModelId,
    accumulatedPaths,
    pageProgress,
    upsertHtmlInBatch,
    extraPromptBlocks,
    existingFiles,
  } = params

  const contextPages = layoutPageContext(page)
  const { htmlOnly } = params
  const hasVisualReference = Boolean(images?.length)
  const htmlModelId = resolveOrchestrationModelId(modelId, hasVisualReference)

  const callPageHtmlText: Parameters<typeof runMonolithicPageHtmlBuild>[0]['callText'] = (
      prompt,
      callOpts,
    ) =>
      callOrchestrationText(prompt, {
        systemInstruction: callOpts.systemInstruction,
        modelId: resolveOrchestrationModelId(
          String(callOpts.modelId ?? htmlModelId),
          hasVisualReference,
        ),
        images: callOpts.images as VertexImagePart[] | undefined,
        signal: callOpts.signal,
      })

    const persistPagePreview = async (html: string) => {
      const ok = await persistIncrementalPageHtml({
        html,
        page,
        designMd,
        contextPages,
        pushFiles,
        onToken: visualProfile ? undefined : onToken,
      })
      if (ok) {
        const path = pageHtmlPath(page.id)
        const idx = htmlOnly.findIndex((h) => h.path === path)
        const content = prepareOrchestrationPageHtmlForPersist(stripImageTags(html), designMd)
        const entry = { path, content }
        if (idx >= 0) htmlOnly[idx] = entry
        else htmlOnly.push(entry)
      }
    }

    let assembledHtml = ''
    let pageAcc = ''

    if (preferIncremental) {
      assembledHtml = await runSequentialPageHtmlBuild({
        page,
        brief,
        designMd,
        extraPromptBlocks,
        device,
        modelId: htmlModelId,
        images,
        visualProfile,
        signal,
        send,
        callText: callPageHtmlText,
        onPartPersisted: persistPagePreview,
      })
      if (isAcceptableOrchestrationPageHtml(assembledHtml)) {
        pageAcc = fenceWrapPageHtml(pageHtmlPath(page.id), assembledHtml)
      }
    } else {
      const monolithRaw = await runMonolithicPageHtmlBuild({
        page,
        brief,
        designMd,
        extraPromptBlocks,
        device,
        modelId: htmlModelId,
        images,
        signal,
        send,
        generateImages,
        preserveExistingImages,
        callText: callPageHtmlText,
      })
      const monolithCandidate = pageHtmlCandidateFromModelResponse(
        monolithRaw,
        page,
        layoutPages,
        device,
        designMd,
      )
      assembledHtml = monolithCandidate.html
      pageAcc = isAcceptableOrchestrationPageHtml(assembledHtml)
        ? fenceWrapPageHtml(pageHtmlPath(page.id), assembledHtml)
        : ''

      if (pageAcc && onToken && !visualProfile) {
        onToken(assembledHtml)
      }

      if (!pageAcc && !hasVisualReference) {
        console.warn(
          `[orchestration] HTML monolítico insuficiente para ${page.id} (${orchestrationPageHtmlIncompleteReason(assembledHtml)}); reintento por partes`,
        )
        send?.('phase', 'html-build:sequential-fallback')
        assembledHtml = await runSequentialPageHtmlBuild({
          page,
          brief,
          designMd,
          extraPromptBlocks,
          device,
          modelId: htmlModelId,
          images,
          visualProfile,
          signal,
          send,
          callText: callPageHtmlText,
          onPartPersisted: persistPagePreview,
        })
        if (isAcceptableOrchestrationPageHtml(assembledHtml)) {
          pageAcc = fenceWrapPageHtml(pageHtmlPath(page.id), assembledHtml)
        }
      }
    }

  if (
    pageAcc &&
    visualProfile &&
    isAcceptableOrchestrationPageHtml(assembledHtml)
  ) {
    const correctionBlocks: string[] = []
    let fidelityCheck = validateHtmlAgainstVisualProfile(
      assembledHtml,
      visualProfile,
      designMd,
    )
    if (!fidelityCheck.ok || isGenericAgencyLandingHtml(assembledHtml, visualProfile)) {
      if (!fidelityCheck.ok) correctionBlocks.push(fidelityCheck.reason)
      if (isGenericAgencyLandingHtml(assembledHtml, visualProfile)) {
        correctionBlocks.push('Estructura HTML no coincide con la captura auditada')
      }

      for (let attempt = 0; attempt < VISUAL_HTML_FIDELITY_MAX_RETRIES; attempt++) {
        console.warn(
          `[orchestration] HTML no fiel a captura (${page.id}), reintento ${attempt + 1}:`,
          correctionBlocks.join('; '),
        )
        send?.('phase', `page:${page.id}:html-retry:${attempt + 1}`)
        const retryModelId = htmlModelId.includes('flash-lite')
          ? htmlModelId.replace('flash-lite', 'flash')
          : htmlModelId
        const retryRaw = await runMonolithicPageHtmlBuild({
          page,
          brief,
          designMd,
          extraPromptBlocks: [
            ...extraPromptBlocks,
            `## Corrección obligatoria (intento ${attempt + 1})\n${correctionBlocks.join('\n')}\nReplica fielmente la captura adjunta y spec/visual-audit.json.`,
          ],
          device,
          modelId: retryModelId,
          images,
          signal,
          send,
          generateImages,
          preserveExistingImages,
          callText: callPageHtmlText,
        })
        const retryCandidate = pageHtmlCandidateFromModelResponse(
          retryRaw,
          page,
          layoutPages,
          device,
          designMd,
        )
        if (!isAcceptableOrchestrationPageHtml(retryCandidate.html)) continue
        assembledHtml = retryCandidate.html
        fidelityCheck = validateHtmlAgainstVisualProfile(
          assembledHtml,
          visualProfile,
          designMd,
        )
        if (fidelityCheck.ok && !isGenericAgencyLandingHtml(assembledHtml, visualProfile)) {
          pageAcc = fenceWrapPageHtml(pageHtmlPath(page.id), assembledHtml)
          break
        }
        if (!fidelityCheck.ok) correctionBlocks.push(fidelityCheck.reason)
      }

      if (!fidelityCheck.ok || isGenericAgencyLandingHtml(assembledHtml, visualProfile)) {
        send?.('phase', `page:${page.id}:html-fidelity-failed`)
        assembledHtml = buildVisualFidelityFailedPlaceholder(page.id, correctionBlocks)
        pageAcc = fenceWrapPageHtml(pageHtmlPath(page.id), assembledHtml)
      }
    }

    if (pageAcc && onToken && isAcceptableOrchestrationPageHtml(assembledHtml)) {
      onToken(assembledHtml)
    }
  }

  if (
    pageAcc &&
    isAcceptableOrchestrationPageHtml(assembledHtml) &&
    isOrchestrationHtmlReviewEnabled(hasVisualReference)
  ) {
    send?.('phase', `page:${page.id}:html-review`)
    const reviewFiles = [...(existingFiles ?? []), ...htmlOnly]
    try {
      const reviewed = await runPageHtmlVisualReview({
        page,
        brief,
        designMd,
        device,
        html: assembledHtml,
        extraPromptBlocks,
        modelId: htmlModelId,
        images,
        projectFiles: reviewFiles,
        signal,
        callText: callPageHtmlText,
      })
      const reviewOk =
        isAcceptableOrchestrationPageHtml(reviewed) &&
        (!visualProfile ||
          validateHtmlAgainstVisualProfile(reviewed, visualProfile, designMd).ok) &&
        !isGenericAgencyLandingHtml(reviewed, visualProfile)
      if (reviewed !== assembledHtml && reviewOk) {
        assembledHtml = reviewed
        pageAcc = fenceWrapPageHtml(pageHtmlPath(page.id), reviewed)
        if (preferIncremental) {
          await persistPagePreview(reviewed)
        } else if (onToken) {
          onToken(reviewed)
        }
      }
    } catch (reviewErr) {
      console.warn(`[orchestration] html-review omitido para ${page.id}:`, reviewErr)
    }
  }

  let pageFiles = resolvePageHtmlFiles(
    pageAcc,
    page,
    layoutPages,
    device,
    tokensJson,
    designMd,
  ).files

  if (!pageFiles.length && assembledHtml.trim()) {
    const prepared = prepareOrchestrationPageHtmlForPersist(
      stripImageTags(assembledHtml),
      designMd,
    )
    if (isAcceptableOrchestrationPageHtml(prepared)) {
      console.info(
        `[orchestration] Persistiendo HTML directo para ${page.id} (${prepared.length} chars)`,
      )
      pageFiles = [{ path: pageHtmlPath(page.id), content: prepared }]
    }
  }

  if (!pageFiles.length) {
    const reason = !assembledHtml.trim()
      ? 'respuesta vacía'
      : orchestrationPageHtmlIncompleteReason(
          prepareOrchestrationPageHtmlForPersist(assembledHtml, designMd),
        )
    console.warn(`[orchestration] Sin HTML persistido para ${page.id} (${reason})`)
    send?.('phase', `page:${page.id}:html-failed:${reason.slice(0, 120)}`)
    return
  }

  await pushFiles(pageFiles)
  upsertHtmlInBatch(pageFiles)
  if (onToken) {
    const primary = pageFiles.find((f) => f.path === pageHtmlPath(page.id))
    if (primary?.content) onToken(primary.content)
  }

  if (runImages && !preserveExistingImages) {
    await runOrchestrationPageImageAssets({
      page,
      pageFiles,
      pageProgress,
      designMd,
      brief,
      imageModelId,
      styleReference: params.styleReference,
      accumulatedPaths,
      send,
      pushFiles,
    })
  }
}

async function runInProcessOrchestration(
  prompt: string,
  opts: OrchestrationOpts = {},
): Promise<OrchestrationResult> {
  let {
    device = 'desktop',
    images,
    modelId,
    onToken,
    send,
    persistPartial,
    signal,
  } = opts

  throwIfAborted(signal)
  send = wrapOrchestrationPhaseSend(send)

  const hasUserImagesEarly = Boolean(opts.images?.length)
  const promptInferred = inferDesignBriefFromPrompt(prompt)
  const brief = mergeDesignBrief(
    opts.brief ?? { prompt },
    hasUserImagesEarly
      ? { ...promptInferred, siteType: undefined, requiredSections: undefined }
      : promptInferred,
  )

  const stitchRef = resolveStitchReferenceForOrchestration(brief.stitchProjectId)
  let orchestrationImages = mergeOrchestrationImageParts(images, stitchRef)
  let orchestrationBrief =
    stitchRef?.referencePrompt?.trim()
      ? mergeDesignBrief(brief, {
          prompt: `${stitchRef.referencePrompt.trim()}\n\n${brief.prompt}`,
        })
      : brief
  const orchestrationLocale = resolveOrchestrationLocale(orchestrationBrief)
  const stitchPromptBlocks = stitchRef
    ? stitchReferencePromptBlocks(stitchRef, orchestrationLocale)
    : []
  if (stitchRef && orchestrationImages.length > (images?.length ?? 0)) {
    send?.('phase', 'stitch-reference-image')
  }

  const allFiles: Array<{ path: string; content: string }> = [
    ...seedOrchestrationFilesFromExisting(opts.existing),
  ]
  const existingPrimaryPages = loadExistingPrimaryPages(opts.existing)

  const pushFiles = async (batch: Array<{ path: string; content: string }>) => {
    throwIfAborted(signal)
    if (!batch.length) return
    allFiles.push(...batch)
    await persistPartial?.(batch)
  }

  const isolationBlocks = opts.replaceDesign ? [orchestrationFreshDesignIsolationBlock()] : []
  const stylePrimerImages: VertexImagePart[] = []
  let stylePrimerProfile: VisualBriefInference | null = null

  // Sin captura del usuario: pedir explícitamente a la IA una paleta temática.
  if (!orchestrationImages.length && !stitchRef) {
    const themePalette = await runThemePaletteDirectionPhase({
      brief: orchestrationBrief,
      modelId: modelId ?? getDesignGenModelId(),
      send,
      pushFiles,
      signal,
    })
    if (themePalette) {
      const enforced = [
        themePalette.styleName ? `Dirección de diseño: ${themePalette.styleName}.` : '',
        themePalette.visualStyle ? `Estilo visual obligatorio: ${themePalette.visualStyle}` : '',
        `Paleta temática obligatoria (usar en spec/design.md): primary ${themePalette.primary ?? 'N/A'}, secondary ${themePalette.secondary ?? 'N/A'}, tertiary ${themePalette.tertiary ?? 'N/A'}, background ${themePalette.background ?? 'N/A'}, surface ${themePalette.surface ?? 'N/A'}, text ${themePalette.text ?? 'N/A'}.`,
        themePalette.typography?.heading || themePalette.typography?.body
          ? `Tipografía orientativa: heading ${themePalette.typography?.heading ?? 'N/A'}, body ${themePalette.typography?.body ?? 'N/A'}${themePalette.typography?.mood ? ` (${themePalette.typography.mood})` : ''}.`
          : '',
        themePalette.layoutDirection
          ? `Layout orientativo obligatorio: ${themePalette.layoutDirection}`
          : '',
        themePalette.componentsDirection
          ? `Componentes (botones/cards/inputs): ${themePalette.componentsDirection}`
          : '',
        themePalette.imageryDirection
          ? `Imaginería/fotografía: ${themePalette.imageryDirection}`
          : '',
        'No reutilices paletas de plantilla; prioriza esta dirección cromática.',
        themePalette.rationale ? `Racional: ${themePalette.rationale}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      orchestrationBrief = { ...orchestrationBrief, prompt: `${orchestrationBrief.prompt}\n\n${enforced}` }
    }
  }

  const hasVisualReference = orchestrationHasVisualReference(
    orchestrationImages,
    stitchRef,
  )
  const resolvedModelId = resolveOrchestrationModelId(
    modelId ?? getDesignGenModelId(),
    hasVisualReference,
  )

  const visualProfile = await resolveVisualProfileForOrchestration({
    orchestrationImages,
    brief: orchestrationBrief,
    modelId: resolvedModelId,
    send,
  })
  const effectiveVisualProfile = visualProfile ?? stylePrimerProfile
  if (effectiveVisualProfile) {
    orchestrationBrief = mergeVisualInferenceIntoBrief(orchestrationBrief, effectiveVisualProfile)
    send?.('phase', 'visual-audit-ready')
    await pushFiles([
      {
        path: 'spec/visual-audit.json',
        content: JSON.stringify(effectiveVisualProfile, null, 2),
      },
    ])
  }
  assertVisualProfileWhenRequired(orchestrationImages, visualProfile)

  device = resolveOrchestrationDevice({
    requestedDevice: device,
    visualProfile: effectiveVisualProfile,
    images: orchestrationImages,
  })

  const baseUserPrompt = composeOrchestrationUserPrompt(orchestrationBrief, [
    ...isolationBlocks,
    ...(hasVisualReference ? [visualReferenceUserPromptBlock()] : []),
    ...(effectiveVisualProfile ? [visualAuditPromptBlock(effectiveVisualProfile)] : []),
    ...orchestrationTextOnlyIdentityBlocks(orchestrationBrief, hasVisualReference),
  ])

  if (stitchRef && isStitchParityEnabled(resolvedModelId)) {
    send?.('phase', 'stitch-parity')
  }

  const { tokensJson, designMd } = await runTokenPhases({
    brief: orchestrationBrief,
    baseUserPrompt,
    modelId: resolvedModelId,
    device,
    images: stylePrimerImages.length ? stylePrimerImages : orchestrationImages,
    visualProfile: effectiveVisualProfile,
    existingPrimaryPages,
    existing: opts.existing,
    forceNewPage: opts.forceNewPage,
    rebuildPageIds: opts.rebuildPageIds,
    replaceDesign: opts.replaceDesign,
    stitchDesignMd: stitchRef?.designMd,
    send,
    pushFiles,
    signal,
  })

  throwIfAborted(signal)

  await runOrchestrationLayoutAndContent({
    brief: orchestrationBrief,
    device,
    images: orchestrationImages,
    visualProfile: effectiveVisualProfile,
    stitchRef,
    modelId: resolvedModelId,
    tokensJson,
    designMd,
    stitchPromptBlocks,
    existingPrimaryPages,
    existingFiles: opts.existing,
    forceNewPage: opts.forceNewPage,
    rebuildPageIds: opts.rebuildPageIds,
    replaceDesign: opts.replaceDesign,
    referencePageId: opts.referencePageId,
    elementContexts: opts.elementContexts,
    generateImages: opts.generateImages,
    imageModelId: opts.imageModelId,
    onToken,
    send,
    pushFiles,
    signal,
  })

  return { files: dedupeFilesByPath(allFiles) }
}

/** Relanza layout → assets → HTML usando tokens ya persistidos (p. ej. tras editar paleta). */
export async function regenerateOrchestrationFromTokens(
  prompt: string,
  opts: OrchestrationOpts & { tokensJson?: string },
): Promise<OrchestrationResult> {
  const {
    device = 'desktop',
    images,
    modelId,
    generateImages,
    onToken,
    send,
    persistPartial,
  } = opts

  const brief = mergeDesignBrief(
    opts.brief ?? { prompt },
    inferDesignBriefFromPrompt(prompt),
  )

  const allFiles: Array<{ path: string; content: string }> = [
    ...seedOrchestrationFilesFromExisting(opts.existing),
  ]
  const existingPrimaryPages = loadExistingPrimaryPages(opts.existing)
  const pushFiles = async (batch: Array<{ path: string; content: string }>) => {
    if (!batch.length) return
    allFiles.push(...batch)
    await persistPartial?.(batch)
  }

  const tokensJson = opts.tokensJson?.trim() ?? ''
  if (!tokensJson || tokensJson === '{}') {
    throw new Error('No hay tokens de diseño para regenerar')
  }
  const envelope = parseTokensJsonEnvelope(tokensJson)
  if (!envelope.tokens?.colors) {
    throw new Error('Tokens inválidos: falta paleta de colores')
  }

  const stitchRef = resolveStitchReferenceForOrchestration(brief.stitchProjectId)
  const regenImages = mergeOrchestrationImageParts(images, stitchRef)
  const stitchPromptBlocks = stitchRef
    ? stitchReferencePromptBlocks(stitchRef, resolveOrchestrationLocale(brief))
    : []
  const regenModelId = modelId ?? getDesignGenModelId()
  const visualProfile = await resolveVisualProfileForOrchestration({
    orchestrationImages: regenImages,
    brief,
    modelId: regenModelId,
    send,
  })
  const regenBrief = visualProfile
    ? mergeVisualInferenceIntoBrief(brief, visualProfile)
    : brief

  await runOrchestrationLayoutAndContent({
    brief: regenBrief,
    device,
    images: regenImages,
    visualProfile,
    stitchRef,
    modelId: regenModelId,
    tokensJson,
    stitchPromptBlocks,
    existingPrimaryPages,
    generateImages,
    onToken,
    send,
    pushFiles,
    signal: opts.signal,
  })

  return { files: dedupeFilesByPath(allFiles) }
}

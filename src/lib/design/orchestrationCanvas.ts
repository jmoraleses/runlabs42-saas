import { DESIGN_BREAKPOINT_PRESETS, type DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import {
  autoLayoutPages,
  mergeDesignPages,
  pageHtmlPath,
  parseDesignSpec,
  resolveDesignPages,
} from '@/lib/design/pages'
import { ensureDesignSystemPage } from '@/lib/design/prototypePages'
import { DESIGN_SPEC_JSON, type DesignPageMeta } from '@/lib/design/types'
import {
  brandTitleFromEnvelope,
  brandToneFromEnvelope,
  parseTokensJsonEnvelope,
  specTokensFromEnvelope,
} from '@/lib/design/normalizeDesignTokens'
import {
  parseLayoutPages,
  synthesizeOrchestrationSpec,
  type OrchestrationLayoutPage,
} from '@/lib/design/orchestrationParse'

/** Páginas del lienzo a partir del layout (sin HTML aún). */
export function buildOrchestrationCanvasPages(
  layoutPages: OrchestrationLayoutPage[],
  device: DesignPreviewBreakpoint,
  tokensJson: string,
  existingPrimaryPages?: DesignPageMeta[],
): DesignPageMeta[] {
  if (!layoutPages.length) return existingPrimaryPages?.length ? existingPrimaryPages : []

  const preset = DESIGN_BREAKPOINT_PRESETS[device]
  const metaPages: DesignPageMeta[] = layoutPages.map((p) => ({
    id: p.id,
    name: p.name ?? (p.id === 'home' ? 'Inicio' : p.id),
    path: pageHtmlPath(p.id),
    width: preset.width,
    height: preset.height,
    media: 'html' as const,
    frameType: 'screen' as const,
  }))

  const incoming = autoLayoutPages(metaPages)
  const merged = existingPrimaryPages?.length
    ? mergeDesignPages(existingPrimaryPages, incoming)
    : incoming

  const envelope = parseTokensJsonEnvelope(tokensJson)
  const spec = {
    version: 2 as const,
    title: brandTitleFromEnvelope(envelope),
    summary: brandToneFromEnvelope(envelope),
    targetDevice: device,
    tokens: specTokensFromEnvelope(envelope),
    pages: merged,
  }

  return ensureDesignSystemPage(spec.pages ?? [], spec)
}

export function buildInterimOrchestrationSpecFile(
  layoutJson: string,
  tokensJson: string,
  device: DesignPreviewBreakpoint,
  existingPrimaryPages?: DesignPageMeta[],
): { path: string; content: string; pages: DesignPageMeta[] } | null {
  const layoutPages = parseLayoutPages(layoutJson)
  if (!layoutPages.length) return null

  const specFile = synthesizeOrchestrationSpec({
    tokensJson,
    layoutJson,
    device,
    htmlFiles: [],
    existingPrimaryPages,
  })
  if (!specFile) return null

  let pages: DesignPageMeta[] = []
  try {
    const spec = JSON.parse(specFile.content) as { pages?: DesignPageMeta[] }
    pages = spec.pages ?? []
  } catch {
    pages = buildOrchestrationCanvasPages(
      layoutPages,
      device,
      tokensJson,
      existingPrimaryPages,
    )
  }

  let specForDs: ReturnType<typeof parseDesignSpec> = null
  try {
    specForDs = parseDesignSpec(specFile.content)
  } catch {
    /* spec interino puede estar incompleto */
  }
  return { ...specFile, pages: ensureDesignSystemPage(pages, specForDs) }
}

/** Solo el marco de design system tras la fase de tokens. */
export function buildTokensOnlyCanvasPages(
  tokensJson: string,
  device: DesignPreviewBreakpoint,
): DesignPageMeta[] {
  const envelope = parseTokensJsonEnvelope(tokensJson)
  const spec = {
    version: 2 as const,
    title: brandTitleFromEnvelope(envelope),
    summary: brandToneFromEnvelope(envelope),
    targetDevice: device,
    tokens: specTokensFromEnvelope(envelope),
    pages: [] as DesignPageMeta[],
  }

  return ensureDesignSystemPage([], spec)
}

/** Spec interino con solo el marco Visual Language (para lienzo + tokens en fase paleta). */
export function buildTokensOnlySpecFile(
  tokensJson: string,
  device: DesignPreviewBreakpoint,
  existingPrimaryPages?: DesignPageMeta[],
): { path: string; content: string; pages: DesignPageMeta[] } {
  const tokenOnly = buildTokensOnlyCanvasPages(tokensJson, device)
  const pages = existingPrimaryPages?.length
    ? mergeDesignPages(existingPrimaryPages, tokenOnly)
    : tokenOnly
  const envelope = parseTokensJsonEnvelope(tokensJson)
  const spec = {
    version: 2 as const,
    title: brandTitleFromEnvelope(envelope),
    summary: brandToneFromEnvelope(envelope),
    targetDevice: device,
    tokens: specTokensFromEnvelope(envelope),
    pages,
  }
  return {
    path: DESIGN_SPEC_JSON,
    content: JSON.stringify(spec, null, 2),
    pages,
  }
}

/** Páginas SSE del lienzo: layout > tokens-only > spec persistido. */
export function resolveOrchestrationStreamPages(opts: {
  specRaw: string | null
  tokensRaw: string | null
  layoutRaw: string | null
  device: DesignPreviewBreakpoint
  pathRefs: Array<{ path: string }>
  existingPrimaryPages?: DesignPageMeta[]
}): DesignPageMeta[] {
  const { specRaw, tokensRaw, layoutRaw, device, pathRefs, existingPrimaryPages } = opts
  const spec = parseDesignSpec(specRaw)

  if (tokensRaw?.trim()) {
    const layoutPages = layoutRaw ? parseLayoutPages(layoutRaw) : []
    if (layoutPages.length) {
      return buildOrchestrationCanvasPages(
        layoutPages,
        device,
        tokensRaw,
        existingPrimaryPages,
      )
    }
    const tokenPages = buildTokensOnlyCanvasPages(tokensRaw, device)
    if (tokenPages.length) {
      return existingPrimaryPages?.length
        ? mergeDesignPages(existingPrimaryPages, tokenPages)
        : tokenPages
    }
  }

  const fromPaths = resolveDesignPages(pathRefs, specRaw)
  const merged = existingPrimaryPages?.length
    ? mergeDesignPages(existingPrimaryPages, fromPaths)
    : fromPaths
  return ensureDesignSystemPage(merged, spec)
}

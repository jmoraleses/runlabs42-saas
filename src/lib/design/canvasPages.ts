import {
  designCanvasPathsFromSpec,
  expandCanvasPagesWithMockupFrames,
  mergeDesignPages,
  parseDesignSpec,
  relayoutStackedScreenPages,
  resolveDesignPages,
} from '@/lib/design/pages'
import { isGeneratingPlaceholderPage } from '@/lib/design/generatingPlaceholder'
import { ensureDesignSystemPage } from '@/lib/design/prototypePages'
import type { DesignPageMeta } from '@/lib/design/types'

type FileRef = { path: string }

/** Fusiona páginas SSE con overlay previo; ignora `[]` y quita el placeholder transitorio. */
export function mergeStreamCanvasOverlayPages(
  prev: DesignPageMeta[] | null | undefined,
  incoming: DesignPageMeta[] | null | undefined,
): DesignPageMeta[] | null {
  if (!incoming?.length) return prev?.length ? prev : null

  const realIncoming = incoming.filter((p) => !isGeneratingPlaceholderPage(p))
  const toMerge = realIncoming.length ? realIncoming : incoming

  if (!prev?.length) return toMerge

  const base = prev.filter((p) => !isGeneratingPlaceholderPage(p))
  const merged = mergeDesignPages(base.length ? base : prev, toMerge)
  const withoutPlaceholder = merged.filter((p) => !isGeneratingPlaceholderPage(p))
  return withoutPlaceholder.length ? withoutPlaceholder : merged
}

export function canClearStreamCanvasOverlay(
  overlay: { paths: string[]; pages: DesignPageMeta[] | null },
  surface: { designJson: string | null; paths: string[] } | null,
): boolean {
  if (!surface?.designJson?.trim()) return false

  const available = new Set([...overlay.paths, ...surface.paths])
  const htmlFromSpec = designCanvasPathsFromSpec(surface.designJson).filter((p) =>
    p.endsWith('.html'),
  )

  if (htmlFromSpec.length) {
    return htmlFromSpec.every((p) => available.has(p))
  }

  return surface.paths.some((p) => p.endsWith('.html') || p.endsWith('.png'))
}

/**
 * Páginas del lienzo: durante el stream no oculta las ya existentes
 * salvo cuando llega un plan nuevo con pantallas reales.
 */
export function resolveDesignCanvasPages(
  fileRefs: FileRef[],
  designJson: string | null,
  streamPages: DesignPageMeta[] | null | undefined,
  opts?: { streamReplaceDesign?: boolean },
): DesignPageMeta[] {
  const byPath = new Map(fileRefs.map((f) => [f.path, f]))
  const spec = parseDesignSpec(designJson)
  const fromServer = ensureDesignSystemPage(
    resolveDesignPages(fileRefs, designJson),
    spec,
  )

  if (!streamPages?.length) {
    return expandCanvasPagesWithMockupFrames(relayoutStackedScreenPages(fromServer), byPath)
  }

  const fromStream = expandCanvasPagesWithMockupFrames(streamPages, byPath)

  if (opts?.streamReplaceDesign && fromStream.length) {
    return expandCanvasPagesWithMockupFrames(
      relayoutStackedScreenPages(ensureDesignSystemPage(fromStream, spec)),
      byPath,
    )
  }
  const onlyPlaceholder =
    fromStream.length === 1 && isGeneratingPlaceholderPage(fromStream[0]!)

  if (onlyPlaceholder && fromServer.length > 0) {
    return expandCanvasPagesWithMockupFrames(relayoutStackedScreenPages(fromServer), byPath)
  }

  if (fromServer.length === 0) {
    return expandCanvasPagesWithMockupFrames(
      relayoutStackedScreenPages(ensureDesignSystemPage(fromStream, spec)),
      byPath,
    )
  }

  const merged = ensureDesignSystemPage(mergeDesignPages(fromServer, streamPages), spec)
  return expandCanvasPagesWithMockupFrames(relayoutStackedScreenPages(merged), byPath)
}

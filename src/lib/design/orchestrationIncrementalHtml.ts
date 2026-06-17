import { stripImageTags } from '@/lib/design/designImageGen'
import {
  isAcceptableOrchestrationPageHtml,
  prepareOrchestrationPageHtmlForPersist,
} from '@/lib/design/orchestrationHtmlQuality'
import { isPreviewableIncrementalPageHtml } from '@/lib/design/htmlPageSequential'
import { isDesignPreviewPlaceholderHtml } from '@/lib/design/isDesignPreviewPlaceholderHtml'
import { isOrchestrationPlaceholderHtml } from '@/lib/design/orchestrationFallbackHtml'
import { pageHtmlPath } from '@/lib/design/pages'
import { parseOrchestrationHtmlFiles } from '@/lib/design/orchestrationParse'
import type { OrchestrationLayoutPage } from '@/lib/design/orchestrationParse'
import { preferMonolithicOrchestrationHtml } from '@/lib/design/stitchParity'
import type { VisualBriefInference } from '@/lib/design/visualBriefInference'

export function preferIncrementalOrchestrationHtml(
  opts: {
    send?: (type: string, data: string) => void
    persistPartial?: (files: Array<{ path: string; content: string }>) => Promise<void>
  },
  modelId?: string,
  visualProfile?: VisualBriefInference | null,
): boolean {
  // Incremental por partes tiende a plantilla nav→hero→features; con auditoría visual usar monolito.
  if (visualProfile) return false
  if (preferMonolithicOrchestrationHtml(modelId, opts)) return false
  return Boolean(opts.send || opts.persistPartial) && process.env.DESIGN_HTML_MONOLITH_FIRST !== '1'
}

function fenceWrapPageHtml(path: string, content: string): string {
  return `\`\`\`html ${path}\n${content}\n\`\`\``
}

export type PersistIncrementalPageHtmlOpts = {
  html: string
  page: Pick<OrchestrationLayoutPage, 'id' | 'name'>
  designMd?: string
  contextPages: ReturnType<typeof import('@/lib/design/orchestrationParse').parseLayoutPages>
  pushFiles: (batch: Array<{ path: string; content: string }>) => Promise<void>
  onToken?: (chunk: string) => void
}

/** Persiste HTML parcial o completo para refrescar el preview del lienzo vía SSE files. */
export async function persistIncrementalPageHtml(
  opts: PersistIncrementalPageHtmlOpts,
): Promise<boolean> {
  const { html, page, designMd, contextPages, pushFiles, onToken } = opts
  const prepared = prepareOrchestrationPageHtmlForPersist(stripImageTags(html), designMd)
  if (isOrchestrationPlaceholderHtml(prepared) || isDesignPreviewPlaceholderHtml(prepared)) {
    return false
  }
  const previewable = isPreviewableIncrementalPageHtml(prepared)
  const acceptable = isAcceptableOrchestrationPageHtml(prepared)
  if (!previewable && !acceptable) return false

  const files = parseOrchestrationHtmlFiles(
    fenceWrapPageHtml(pageHtmlPath(page.id), prepared),
    contextPages,
  )
  if (!files.length) return false
  await pushFiles(files)
  onToken?.(prepared)
  return true
}

import type { DesignBrief } from '@/lib/design/designBrief'
import {
  composeOrchestrationUserPrompt,
  orchestrationLocaleHtmlReviewBlock,
  resolveOrchestrationLocale,
} from '@/lib/design/designBrief'
import { designMdHtmlGuidanceBlocks } from '@/lib/design/designMd'
import type { DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import { pageHtmlPath } from '@/lib/design/pages'
import { captureDesignPageReviewScreenshot } from '@/lib/design/captureDesignPageReviewScreenshot.server'
import { htmlVisualReviewSystemInstruction } from '@/lib/design/orchestrationPrompts'
import {
  extractLargestHtmlDocumentFromModelText,
  isAcceptableOrchestrationPageHtml,
  prepareOrchestrationPageHtmlForPersist,
} from '@/lib/design/orchestrationHtmlQuality'
import type { OrchestrationLayoutPage } from '@/lib/design/orchestrationParse'
import type { SequentialPageHtmlCall } from '@/lib/design/htmlPageSequential'
import type { VertexImagePart } from '@/lib/ai/vertexAgentPlatform'

async function writeOrchestrationProbeArtifacts(
  label: 'before' | 'after',
  opts: {
    html: string
    designMd?: string
    device: DesignPreviewBreakpoint
    pageHtmlPath: string
    projectFiles?: Array<{ path: string; content: string }>
    signal?: AbortSignal
    screenshot?: VertexImagePart | null
  },
): Promise<void> {
  const dir = process.env.ORCHESTRATION_PROBE_DIR?.trim()
  if (!dir) return
  const { mkdirSync, writeFileSync } = await import('fs')
  const { resolve } = await import('path')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, `page-${label}-review.html`), opts.html, 'utf8')
  if (opts.screenshot?.data) {
    writeFileSync(
      resolve(dir, label === 'before' ? 'screenshot-first.png' : 'screenshot-last.png'),
      Buffer.from(opts.screenshot.data, 'base64'),
    )
  } else if (label === 'before') {
    const { captureDesignPageReviewScreenshot } = await import(
      '@/lib/design/captureDesignPageReviewScreenshot.server'
    )
    const shot = await captureDesignPageReviewScreenshot({
      html: opts.html,
      pageHtmlPath: opts.pageHtmlPath,
      designMd: opts.designMd,
      device: opts.device,
      projectFiles: opts.projectFiles,
      signal: opts.signal,
    })
    if (shot?.data) {
      writeFileSync(resolve(dir, 'screenshot-first.png'), Buffer.from(shot.data, 'base64'))
    }
  }
}

function designMdReviewPromptBlocks(designMd?: string): string[] {
  const md = designMd?.trim()
  if (!md) return designMdHtmlGuidanceBlocks('', 'review')

  return [
    '## spec/design.md (documento completo — única fuente de verdad visual)',
    'Aplica colores del YAML, tipografías, ## Components, ## Shapes, ## Layout & Spacing y ## Photography & Imagery.',
    md,
    ...designMdHtmlGuidanceBlocks(md, 'review').filter(
      (b) => !b.startsWith('## spec/design.md — FUENTE DE VERDAD'),
    ),
  ]
}

/** Revisión visual post-HTML (screenshot + LLM). Desactivar con DESIGN_HTML_REVIEW=0. */
export function isOrchestrationHtmlReviewEnabled(hasVisualReference = false): boolean {
  if (hasVisualReference) return true
  return process.env.DESIGN_HTML_REVIEW !== '0'
}

export type RunPageHtmlVisualReviewOpts = {
  page: OrchestrationLayoutPage
  brief: DesignBrief
  designMd?: string
  device: DesignPreviewBreakpoint
  html: string
  extraPromptBlocks: string[]
  modelId: string
  /** Referencia visual del usuario (brief), además de la captura del render. */
  images?: VertexImagePart[]
  projectFiles?: Array<{ path: string; content: string }>
  signal?: AbortSignal
  callText: SequentialPageHtmlCall
}

export async function runPageHtmlVisualReview(
  opts: RunPageHtmlVisualReviewOpts,
): Promise<string> {
  const hasVisualReference = Boolean(opts.images?.length)
  if (!isOrchestrationHtmlReviewEnabled(hasVisualReference)) {
    return opts.html.trim()
  }

  const {
    page,
    brief,
    designMd,
    device,
    html,
    extraPromptBlocks,
    modelId,
    images,
    projectFiles,
    signal,
    callText,
  } = opts

  const input = html.trim()
  if (!input || !isAcceptableOrchestrationPageHtml(prepareOrchestrationPageHtmlForPersist(input, designMd))) {
    return input
  }

  const path = pageHtmlPath(page.id)
  const screenshot = await captureDesignPageReviewScreenshot({
    html: input,
    pageHtmlPath: path,
    designMd,
    device,
    projectFiles,
    signal,
  })

  await writeOrchestrationProbeArtifacts('before', {
    html: input,
    designMd,
    device,
    pageHtmlPath: path,
    projectFiles,
    signal,
    screenshot,
  })

  const reviewImages: VertexImagePart[] = [
    ...(screenshot ? [screenshot] : []),
    ...(images ?? []),
  ]

  const locale = resolveOrchestrationLocale(brief)
  const localeReview = orchestrationLocaleHtmlReviewBlock(locale)

  const blocks = [
    ...designMdReviewPromptBlocks(designMd),
    ...(localeReview ? [localeReview] : []),
    ...extraPromptBlocks.filter((b) => !b.trimStart().startsWith('## spec/design.md')),
    `## Pantalla a revisar: ${page.name ?? page.id} (\`${path}\`)`,
    `## layoutStrategy: ${page.layoutStrategy ?? 'modular'}`,
    ...(screenshot
      ? [
          '## Capturas adjuntas',
          '**Primera imagen:** screenshot del HTML actual renderizado — corrige desajustes entre código, pantalla y spec/design.md.',
          '**Última imagen (si hay más de una):** captura gold Stitch o referencia del usuario — el layout final (bento, hero, grid productos, footer) debe equivaler a esa captura, no a un tema genérico.',
        ]
      : []),
    `## HTML completo (no fragmentos — revisa y devuelve el documento entero)`,
    input,
    `Genera un único bloque \`\`\`html ${path} con el HTML **completo** refinado (<!DOCTYPE> … </html>).`,
  ]

  const prompt = composeOrchestrationUserPrompt(brief, blocks)
  const raw = await callText(prompt, {
    systemInstruction: htmlVisualReviewSystemInstruction(device, Boolean(screenshot), {
      modelId,
      locale,
    }),
    modelId,
    images: reviewImages.length ? reviewImages : undefined,
    signal,
  })

  const extracted =
    extractLargestHtmlDocumentFromModelText(raw) ??
    extractLargestHtmlDocumentFromModelText(
      raw.includes('```') ? raw : `\`\`\`html ${path}\n${raw}\n\`\`\``,
    )
  if (!extracted?.trim()) return input

  const prepared = prepareOrchestrationPageHtmlForPersist(extracted, designMd)
  if (!isAcceptableOrchestrationPageHtml(prepared)) return input

  const afterShot = await captureDesignPageReviewScreenshot({
    html: prepared,
    pageHtmlPath: path,
    designMd,
    device,
    projectFiles,
    signal,
  })
  await writeOrchestrationProbeArtifacts('after', {
    html: prepared,
    designMd,
    device,
    pageHtmlPath: path,
    projectFiles,
    signal,
    screenshot: afterShot,
  })

  return prepared
}

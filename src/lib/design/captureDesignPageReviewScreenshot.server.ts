import 'server-only'

import type { VertexImagePart } from '@/lib/ai/vertexAgentPlatform'
import { DESIGN_BREAKPOINT_PRESETS, type DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import { prepareHtmlForReviewScreenshot } from '@/lib/design/prepareHtmlForReviewScreenshot'

export type CaptureDesignPageReviewScreenshotOpts = {
  html: string
  pageHtmlPath: string
  designMd?: string
  device: DesignPreviewBreakpoint
  projectFiles?: Array<{ path: string; content: string }>
  signal?: AbortSignal
}

/** Captura PNG del HTML montado (Playwright) para la revisión visual post-generación. */
export async function captureDesignPageReviewScreenshot(
  opts: CaptureDesignPageReviewScreenshotOpts,
): Promise<VertexImagePart | null> {
  if (process.env.DESIGN_HTML_REVIEW_SCREENSHOT === '0') return null
  if (opts.signal?.aborted) return null

  const html = opts.html.trim()
  if (!html) return null

  try {
    const { chromium } = await import('playwright')
    const { width, height } = DESIGN_BREAKPOINT_PRESETS[opts.device]
    const prepared = prepareHtmlForReviewScreenshot(
      html,
      opts.pageHtmlPath,
      opts.designMd,
      opts.projectFiles ?? [],
    )

    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
      })
      await page.setContent(prepared, {
        waitUntil: 'networkidle',
        timeout: 20_000,
      })
      await page.waitForTimeout(400)
      const buffer = await page.screenshot({
        type: 'png',
        fullPage: true,
        animations: 'disabled',
      })
      if (!buffer?.length) return null
      return {
        mimeType: 'image/png',
        data: buffer.toString('base64'),
      }
    } finally {
      await browser.close()
    }
  } catch (err) {
    console.warn('[design/html-review] No se pudo capturar screenshot del preview:', err)
    return null
  }
}

import { injectDesignMdThemeIntoHtml } from '@/lib/design/designMd'
import { isStitchStyleHtml } from '@/lib/design/stitchParity'
import { inlineDesignPageAssets } from '@/lib/design/inlineDesignPageAssets'
import { injectDesignPreviewBoot } from '@/lib/design/previewServe'

export { inlineDesignPageAssets } from '@/lib/design/inlineDesignPageAssets'

export function prepareHtmlForReviewScreenshot(
  html: string,
  pageHtmlPath: string,
  designMd: string | undefined,
  projectFiles: Array<{ path: string; content: string }>,
): string {
  let out = inlineDesignPageAssets(html.trim(), pageHtmlPath, projectFiles)
  if (!isStitchStyleHtml(out)) {
    out = injectDesignMdThemeIntoHtml(out, designMd ?? null)
  }
  return injectDesignPreviewBoot(out)
}

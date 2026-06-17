import 'server-only'

import {
  generateAgentPlatformImage,
  generateImagen4Image,
} from '@/lib/ai/vertexAgentPlatform'
import { type GeneratedImage, type ImageRequest } from '@/lib/ai/imageGen'
import {
  collectDesignImageRequests,
  normalizeDesignImagePath,
} from '@/lib/design/designImageRequests'
import {
  getDesignAssetGenModelCandidates,
  getImageGenApiKey,
  imageGenAllowsApiKeyFallback,
  isVertexAIConfigured,
} from '@/lib/ai/config.server'
import { generateImage } from '@/lib/ai/imageGen'
import { isImagenModelId, normalizeDesignAspectRatio } from '@/lib/ai/constants'
import { markVertexImageModelFailed } from '@/lib/ai/vertexImageModelProbe'
import type { DesignBrief } from '@/lib/design/designBrief'
import { augmentDesignAssetPrompt } from '@/lib/design/designPhotographyStyle'

const IMAGE_TAG_RE = /\[IMAGE:\s*[^\]]+\]/g

export { normalizeDesignImagePath, collectDesignImageRequests, parseImageRequestsFromHtml } from '@/lib/design/designImageRequests'

export function stripImageTags(text: string): string {
  return text.replace(IMAGE_TAG_RE, '').trim()
}

/** Vertex o API key listos para generar assets de diseño. */
export async function isDesignImageGenAvailable(): Promise<boolean> {
  const { getDesignImageGenBlockReason } = await import(
    '@/lib/design/designImageGenAvailability.server'
  )
  return (await getDesignImageGenBlockReason()) === null
}

async function generateDesignAssetImage(
  req: ImageRequest,
  photographyStyle?: string,
  imageModelId?: string,
  styleReference?: { mimeType: string; data: string },
): Promise<{ data: string; mimeType: string } | null> {
  const aspect = normalizeDesignAspectRatio(req.aspect ?? '16:9')
  const rawPrompt = req.prompt.trim()
  if (!rawPrompt) return null
  const prompt = photographyStyle?.trim()
    ? augmentDesignAssetPrompt(rawPrompt, photographyStyle)
    : rawPrompt

  if (isVertexAIConfigured()) {
    let lastError: unknown
    const modelCandidates = await getDesignAssetGenModelCandidates(imageModelId)
    if (!modelCandidates.length) return null
    for (const modelId of modelCandidates) {
      try {
        const img = isImagenModelId(modelId)
          ? await generateImagen4Image(prompt, { aspect, modelId })
          : await generateAgentPlatformImage(prompt, { aspect, modelId, styleReference })
        if (img?.data) return img
      } catch (err) {
        lastError = err
        const status = (err as Error & { status?: number }).status
        markVertexImageModelFailed(modelId, status)
        const label = isImagenModelId(modelId) ? 'Imagen 4' : 'Nano Banana'
        console.warn(
          `[designImageGen] ${label} falló (${modelId}) para ${req.path}:`,
          err instanceof Error ? err.message : err,
        )
        if (status === 429 || status === 503) break
      }
    }
    if (lastError) {
      console.warn(`[designImageGen] Vertex agotado para ${req.path}`)
    }
  }

  if (imageGenAllowsApiKeyFallback() && getImageGenApiKey()) {
    try {
      const img = await generateImage(prompt, aspect)
      if (img?.data) return img
    } catch (err) {
      console.warn(
        `[designImageGen] Fallback API key falló para ${req.path}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  return null
}

function finalImagePath(req: ImageRequest, mimeType: string): string {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const normalized = normalizeDesignImagePath(req.path)
  return normalized.includes('.') ? normalized : `${normalized}.${ext}`
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (!items.length) return
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      await fn(items[i]!, i)
    }
  })
  await Promise.all(workers)
}

export type GenerateDesignImagesProgressiveHandlers = {
  send?: (type: string, data: string) => void
  onImageReady: (image: GeneratedImage) => void | Promise<void>
  pageId?: string
  pageProgress?: string
  pageHtmlPath?: string
  htmlFiles?: Array<{ path: string; content: string }>
  elementSkId?: string
  elementSkIds?: string[]
  /** Dirección de arte unificada para todos los assets de la página/sitio. */
  photographyStyle?: string
  /** Modelo Vertex elegido en el compositor (si no, usa admin). */
  imageModelId?: string
  /** Brief del usuario — alinea prompts inferidos con el producto pedido. */
  brief?: Partial<DesignBrief>
  /** Imagen de referencia visual — se pasa a Gemini para transferir estilo fotográfico. */
  styleReference?: { mimeType: string; data: string }
}

/** Genera assets [IMAGE:] e imágenes referenciadas en <img> en paralelo. */
export async function generateDesignImagesProgressive(
  sources: string[],
  handlers: GenerateDesignImagesProgressiveHandlers,
): Promise<GeneratedImage[]> {
  if (!(await isDesignImageGenAvailable())) return []

  const skFilter = handlers.elementSkIds?.length
    ? { elementSkIds: handlers.elementSkIds }
    : handlers.elementSkId
      ? { elementSkId: handlers.elementSkId }
      : {}
  const requests = collectDesignImageRequests(sources, {
    pageHtmlPath: handlers.pageHtmlPath,
    htmlFiles: handlers.htmlFiles,
    brief: handlers.brief,
    ...skFilter,
  })
  if (!requests.length) return []

  const send = handlers.send
  if (handlers.pageId) {
    send?.('phase', `page-assets:${handlers.pageId}:${handlers.pageProgress ?? '1/1'}`)
  }

  const maxConcurrent = Math.min(
    8,
    Math.max(1, Number(process.env.DESIGN_IMAGE_MAX_CONCURRENT ?? 4) || 4),
  )
  const results: GeneratedImage[] = []

  await runWithConcurrency(requests, maxConcurrent, async (req) => {
    send?.('phase', `image:${req.path}`)
    const img = await generateDesignAssetImage(
      req,
      handlers.photographyStyle,
      handlers.imageModelId,
      handlers.styleReference,
    )
    if (!img) {
      console.warn(`[designImageGen] No se generó ${req.path}`)
      return
    }
    const sizeKB = Math.round((img.data.length * 3) / 4 / 1024)
    if (sizeKB < 5) {
      console.warn(`[designImageGen] Imagen demasiado pequeña (${sizeKB}KB), descartando: ${req.path}`)
      return
    }
    const entry: GeneratedImage = {
      path: finalImagePath(req, img.mimeType),
      content: img.data,
      mimeType: img.mimeType,
    }
    results.push(entry)
    await handlers.onImageReady(entry)
  })

  if (requests.length > 0 && results.length === 0) {
    send?.('phase', 'images-failed')
  }
  return results
}

export type GenerateDesignImagesOpts = {
  emitBatchPhase?: boolean
  pageId?: string
  pageProgress?: string
  htmlFiles?: Array<{ path: string; content: string }>
  /** Solo generar assets del elemento marcado (data-sk-id). */
  elementSkId?: string
  elementSkIds?: string[]
  photographyStyle?: string
  imageModelId?: string
  brief?: Partial<DesignBrief>
  /** Imagen de referencia visual — se pasa a Gemini para transferir estilo fotográfico. */
  styleReference?: { mimeType: string; data: string }
}

export async function generateDesignImagesFromOutput(
  sources: string[],
  send?: (type: string, data: string) => void,
  opts?: GenerateDesignImagesOpts,
): Promise<GeneratedImage[]> {
  if (!(await isDesignImageGenAvailable())) return []

  const skFilter = opts?.elementSkIds?.length
    ? { elementSkIds: opts.elementSkIds }
    : opts?.elementSkId
      ? { elementSkId: opts.elementSkId }
      : {}
  const requests = collectDesignImageRequests(sources, {
    htmlFiles: opts?.htmlFiles,
    brief: opts?.brief,
    ...skFilter,
  })
  if (!requests.length) return []

  const emitBatch = opts?.emitBatchPhase !== false
  if (opts?.pageId) {
    send?.('phase', `page-assets:${opts.pageId}:${opts.pageProgress ?? '1/1'}`)
  } else if (emitBatch) {
    send?.('phase', 'images')
  }

  return generateDesignImagesProgressive(sources, {
    send,
    pageId: opts?.pageId,
    pageProgress: opts?.pageProgress,
    htmlFiles: opts?.htmlFiles,
    elementSkId: opts?.elementSkId,
    elementSkIds: opts?.elementSkIds,
    photographyStyle: opts?.photographyStyle,
    imageModelId: opts?.imageModelId,
    brief: opts?.brief,
    styleReference: opts?.styleReference,
    onImageReady: async () => {},
  })
}

export function stripImageTagsFromDesignFiles(
  files: Array<{ path: string; content: string }>,
): Array<{ path: string; content: string }> {
  return files.map((f) =>
    f.path.endsWith('.html') || f.path.endsWith('.md')
      ? { ...f, content: stripImageTags(f.content) }
      : f,
  )
}

export function mergeDesignFilesWithImages(
  files: Array<{ path: string; content: string }>,
  images: GeneratedImage[],
): Array<{ path: string; content: string }> {
  const imageFiles = images.map((img) => ({
    path: img.path,
    content: img.content,
  }))
  const byPath = new Map<string, { path: string; content: string }>()
  for (const f of files) byPath.set(f.path, f)
  for (const img of imageFiles) byPath.set(img.path, img)
  return [...byPath.values()]
}

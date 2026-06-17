/**
 * Generación de imágenes — Vertex AI (GCP only para pipeline de diseño).
 * Nano Banana para assets HTML legacy; Imagen 4 vía generateDesignMockups.
 */

import 'server-only'

import { IMAGE_GEN_MODEL, isImagenModelId } from '@/lib/ai/constants'
import {
  getGeminiApiKey,
  getImageGenApiKey,
  getImageGenProvider,
  getImageGenVertexModelCandidates,
  getVertexAICredentials,
  imageGenAllowsApiKeyFallback,
} from '@/lib/ai/config.server'
import {
  generateAgentPlatformImage,
  generateImagen4Image,
} from '@/lib/ai/vertexAgentPlatform'

export { IMAGE_GEN_MODEL } from '@/lib/ai/constants'
export { IMAGE_GEN_MODEL_HQ } from '@/lib/ai/constants'

const IMAGE_GEN_DELAY_MS = Number(process.env.IMAGE_GEN_DELAY_MS ?? 2200) || 2200
const IMAGE_GEN_MAX_RETRIES = 3

export type GeneratedImage = {
  path: string
  content: string
  mimeType: string
}

export type ImageRequest = {
  path: string
  prompt: string
  aspect?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableVertexStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 500
}

function normalizeAspectRatio(aspect: string): string {
  const a = aspect.trim()
  if (['1:1', '3:4', '4:3', '9:16', '16:9'].includes(a)) return a
  return '16:9'
}

/**
 * Parsea los tags [IMAGE: path | prompt | aspect?] del texto generado por el AI.
 * Formato: [IMAGE: public/images/hero.jpg | A modern hero banner, blue theme | 16:9]
 */
export function parseImageRequests(text: string): ImageRequest[] {
  const regex = /\[IMAGE:\s*([^\]|]+)\s*\|\s*([^\]|]+?)(?:\s*\|\s*([^\]]+))?\s*\]/g
  const requests: ImageRequest[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const path = match[1]?.trim() ?? ''
    const prompt = match[2]?.trim() ?? ''
    const aspect = match[3]?.trim()
    if (path && prompt) {
      requests.push({ path, prompt, aspect })
    }
  }

  return requests
}

async function generateVertexImage(
  prompt: string,
  aspect: string,
  modelId: string,
): Promise<{ data: string; mimeType: string } | null> {
  if (isImagenModelId(modelId)) {
    return generateImagen4Image(prompt, { aspect, modelId, sampleCount: 1 })
  }
  return generateAgentPlatformImage(prompt, { aspect, modelId })
}

async function generateImageWithVertexRetry(
  prompt: string,
  aspect: string,
): Promise<{ data: string; mimeType: string } | null> {
  let lastError: unknown
  const candidates = getImageGenVertexModelCandidates()

  for (const modelId of candidates) {
    const label = isImagenModelId(modelId) ? 'Imagen 4' : 'Nano Banana'
    for (let attempt = 0; attempt < IMAGE_GEN_MAX_RETRIES; attempt++) {
      try {
        const img = await generateVertexImage(prompt, aspect, modelId)
        if (img?.data) return img
        return null
      } catch (err) {
        lastError = err
        const status = (err as Error & { status?: number }).status
        if (status != null && isRetryableVertexStatus(status) && attempt < IMAGE_GEN_MAX_RETRIES - 1) {
          const backoff = Math.min(12_000, 1500 * 2 ** attempt)
          console.warn(
            `[imageGen] Vertex ${label} ${status} (${modelId}), reintento ${attempt + 2}/${IMAGE_GEN_MAX_RETRIES} en ${backoff}ms`,
          )
          await sleep(backoff)
          continue
        }
        console.warn(
          `[imageGen] Vertex ${label} falló con ${modelId}:`,
          err instanceof Error ? err.message : err,
        )
        break
      }
    }
  }

  if (lastError) throw lastError
  return null
}

async function generateImageWithApiKey(
  prompt: string,
  aspect: string,
  apiKey: string,
): Promise<{ data: string; mimeType: string } | null> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const aspectRatio = normalizeAspectRatio(aspect)

  const model = genAI.getGenerativeModel({
    model: IMAGE_GEN_MODEL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: {
      responseModalities: ['image'],
      imageGenerationConfig: { aspectRatio },
    } as any,
  })

  const result = await model.generateContent(prompt)
  const candidate = result.response.candidates?.[0]
  if (!candidate) return null

  for (const part of candidate.content.parts) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      return { data: part.inlineData.data, mimeType: part.inlineData.mimeType }
    }
  }

  return null
}

export async function generateImage(
  prompt: string,
  aspect = '16:9',
): Promise<{ data: string; mimeType: string } | null> {
  const { isDesignImageGenerationEnabled } = await import(
    '@/lib/platform/designImageGenerationSetting.server'
  )
  if (!(await isDesignImageGenerationEnabled())) {
    return null
  }

  const provider = getImageGenProvider()
  const vertexCreds = getVertexAICredentials()
  const imageApiKey = getImageGenApiKey()
  const legacyApiKey = getGeminiApiKey()
  const apiKey = imageApiKey ?? legacyApiKey

  if (provider === 'api_key') {
    if (!apiKey) {
      console.warn('[imageGen] IMAGE_GEN_PROVIDER=api_key pero no hay GEMINI_API_KEY')
      return null
    }
    try {
      return await generateImageWithApiKey(prompt, aspect, apiKey)
    } catch (err) {
      console.error('[imageGen] Error generando imagen (API key):', err)
      return null
    }
  }

  if (vertexCreds) {
    try {
      const img = await generateImageWithVertexRetry(prompt, aspect)
      if (img) return img
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const is429 = msg.includes('429') || msg.includes('Resource exhausted')
      console.warn(
        `[imageGen] Vertex (Imagen 4 / Nano Banana) no disponible${is429 ? ' (cuota 429)' : ''}`,
        msg,
      )
      if (provider === 'vertex' || !imageGenAllowsApiKeyFallback()) {
        return null
      }
    }
  }

  if (provider === 'vertex') {
    return null
  }

  if (!imageGenAllowsApiKeyFallback()) {
    if (!vertexCreds) {
      console.warn(
        '[imageGen] Configura Vertex AI Agent Platform (GOOGLE_APPLICATION_CREDENTIALS).',
      )
    }
    return null
  }

  if (!apiKey) return null
  try {
    return await generateImageWithApiKey(prompt, aspect, apiKey)
  } catch (err) {
    console.error('[imageGen] Error generando imagen (fallback API key):', err)
    return null
  }
}

export async function generateImagesFromText(
  text: string,
  send?: (type: string, data: string) => void,
): Promise<GeneratedImage[]> {
  const requests = parseImageRequests(text)
  if (requests.length === 0) return []

  const results: GeneratedImage[] = []

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i]!
    send?.('phase', `image:${req.path}`)

    if (i > 0 && IMAGE_GEN_DELAY_MS > 0) {
      await sleep(IMAGE_GEN_DELAY_MS)
    }

    const img = await generateImage(req.prompt, req.aspect ?? '16:9')
    if (!img) {
      console.warn(`[imageGen] No se generó imagen para ${req.path}`)
      continue
    }

    const ext = img.mimeType === 'image/png' ? 'png' : img.mimeType === 'image/webp' ? 'webp' : 'jpg'
    const finalPath = req.path.includes('.') ? req.path : `${req.path}.${ext}`

    results.push({
      path: finalPath,
      content: img.data,
      mimeType: img.mimeType,
    })
  }

  if (requests.length > 0 && results.length === 0) {
    console.error(
      '[imageGen] Ninguna imagen generada. Usa Vertex AI Agent Platform (Nano Banana) o habilita cuota de imagen en GCP.',
    )
  }

  return results
}

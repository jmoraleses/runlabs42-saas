import 'server-only'

import { generateAgentPlatformImage, generateAgentPlatformText } from '@/lib/ai/vertexAgentPlatform'
import { generateImagen4Image } from '@/lib/ai/vertexAgentPlatform'
import { isGeminiEnabled } from '@/lib/ai/config.server'
import type { StitchScreenWithBuffers } from '@/lib/auto/stitch/generateFullStitchSite'
import { composeCoverFallback } from '@/lib/auto/covers/composeCover'

const COVER_SYSTEM = `You are a marketplace listing art director. Given ecommerce page screenshots, write ONE English prompt for an AI image generator to create a TemplateMonster-style product cover thumbnail.
Rules:
- 16:9 professional template marketplace preview
- Show device mockups or multi-screen collage aesthetic inspired by the screenshots' colors and layout rhythm
- NO readable fake text, NO third-party logos, NO watermarks
- Output ONLY the image prompt, one paragraph, no JSON.`

export type MarketplaceCoverResult = {
  pngBase64: string
  thumbBase64: string
  source: 'vertex' | 'sharp-fallback'
}

export async function generateMarketplaceCover(opts: {
  niche: string
  templateLabel: string
  screens: StitchScreenWithBuffers[]
}): Promise<MarketplaceCoverResult> {
  const images = opts.screens
    .filter((s) => s.pngBase64)
    .slice(0, 5)
    .map((s) => ({ mimeType: 'image/png' as const, data: s.pngBase64 }))

  if (!isGeminiEnabled() || !images.length) {
    const fb = await composeCoverFallback(opts.screens)
    return { ...fb, source: 'sharp-fallback' }
  }

  try {
    const analysis = await generateAgentPlatformText(
      `Niche: ${opts.niche}\nTemplate: ${opts.templateLabel}\nCreate the Imagen prompt for the marketplace cover using the attached page screenshots as visual reference.`,
      {
        systemInstruction: COVER_SYSTEM,
        images,
        temperature: 0.4,
      },
    )
    const imagenPrompt = analysis.trim().slice(0, 2000)

    let pngBase64: string | null = null

    const geminiImg = await generateAgentPlatformImage(imagenPrompt, {
      aspect: '16:9',
      styleReference: images[0],
    }).catch(() => null)

    if (geminiImg?.data) {
      pngBase64 = geminiImg.data
    } else {
      const imagen = await generateImagen4Image(imagenPrompt, { aspect: '16:9' })
      pngBase64 = imagen?.data ?? null
    }

    if (!pngBase64) {
      const fb = await composeCoverFallback(opts.screens)
      return { ...fb, source: 'sharp-fallback' }
    }

    const sharp = (await import('sharp')).default
    const thumb = await sharp(Buffer.from(pngBase64, 'base64'))
      .resize(800, 450, { fit: 'cover' })
      .png()
      .toBuffer()

    return {
      pngBase64,
      thumbBase64: thumb.toString('base64'),
      source: 'vertex',
    }
  } catch {
    const fb = await composeCoverFallback(opts.screens)
    return { ...fb, source: 'sharp-fallback' }
  }
}

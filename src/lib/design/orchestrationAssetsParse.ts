import type { DesignBrief } from '@/lib/design/designBrief'
import {
  augmentDesignAssetPrompt,
  photographyStyleFromBrief,
} from '@/lib/design/designPhotographyStyle'
import { extractJsonFromModelText } from '@/lib/design/orchestrationParse'
import type { GeneratedImage } from '@/lib/ai/imageGen'

export const DESIGN_ASSETS_PLAN_PATH = 'spec/design-assets.json'

export type OrchestrationAssetPlanItem = {
  path: string
  prompt: string
  aspect?: string
}

export type OrchestrationAssetPlan = {
  assets: OrchestrationAssetPlanItem[]
}

export function parseAssetPlanFromModelText(text: string): OrchestrationAssetPlan | null {
  const parsed = extractJsonFromModelText(text)
  if (!parsed || typeof parsed !== 'object') return null
  const assetsRaw = (parsed as { assets?: unknown }).assets
  if (!Array.isArray(assetsRaw)) return null

  const assets: OrchestrationAssetPlanItem[] = []
  for (const item of assetsRaw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const path = String(row.path ?? '').trim()
    const prompt = String(row.prompt ?? '').trim()
    if (!path || !prompt) continue
    assets.push({
      path,
      prompt,
      aspect: row.aspect ? String(row.aspect) : undefined,
    })
  }

  return assets.length ? { assets } : null
}

export function assetPlanToFile(plan: OrchestrationAssetPlan): {
  path: string
  content: string
} {
  return {
    path: DESIGN_ASSETS_PLAN_PATH,
    content: JSON.stringify(plan, null, 2),
  }
}

/** Plan mínimo cuando el modelo no devuelve JSON de assets. */
export function buildFallbackAssetPlan(brief: DesignBrief): OrchestrationAssetPlan {
  const tone = brief.brandTone?.trim() || 'modern'
  const topic = brief.prompt.trim().slice(0, 120) || 'website'
  const style = photographyStyleFromBrief(brief)
  const withStyle = (subject: string) => augmentDesignAssetPrompt(subject, style)
  const common = [
    {
      path: 'assets/hero.jpg',
      prompt: withStyle(`Wide hero banner for ${tone} ${topic}, no text overlay`),
      aspect: '16:9',
    },
    {
      path: 'assets/texture.jpg',
      prompt: withStyle(`Subtle organic background texture matching ${tone} palette, soft grain, abstract`),
      aspect: '16:9',
    },
  ]
  if (brief.siteType === 'ecommerce') {
    return {
      assets: [
        ...common,
        {
          path: 'assets/product-1.jpg',
          prompt: withStyle(`Product shot: ${topic}, catalog thumbnail, sharp focus`),
          aspect: '1:1',
        },
        {
          path: 'assets/product-2.jpg',
          prompt: withStyle(`Second product shot: ${topic}, matching catalog session`),
          aspect: '4:3',
        },
      ],
    }
  }
  return {
    assets: [
      ...common,
      {
        path: 'assets/feature.jpg',
        prompt: withStyle(`Feature section photo for ${topic}, clean composition`),
        aspect: '4:3',
      },
    ],
  }
}

export function formatPreGeneratedAssetsBlock(images: GeneratedImage[]): string {
  if (!images.length) return ''
  const lines = images.map(
    (img) => `- \`${img.path}\` (${img.mimeType}) — ya generado; usa esta ruta en <img src="...">`,
  )
  return ['## Assets pre-generados (obligatorio usar rutas)', ...lines].join('\n')
}

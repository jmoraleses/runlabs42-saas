import 'server-only'

import type { CodeTemplate } from '@/lib/codeTemplates'
import { generateAgentPlatformText } from '@/lib/ai/vertexAgentPlatform'
import { isGeminiEnabled } from '@/lib/ai/config.server'

export type MarketplaceListing = {
  title: string
  shortDescription: string
  description: string
  tags: string[]
  category: string
  suggestedPriceUsd: number
  compatibility: string[]
  features: string[]
  coverImagePath?: string
}

export async function generateListingMetadata(opts: {
  niche: string
  codeTemplate: CodeTemplate
  projectName: string
  pageNames: string[]
}): Promise<MarketplaceListing> {
  const fallback: MarketplaceListing = {
    title: `${opts.projectName} — ${opts.codeTemplate} Store Template`,
    shortDescription: `Modern ${opts.niche} ecommerce template for ${opts.codeTemplate}.`,
    description: `Professional multi-page ${opts.niche} store template. Includes: ${opts.pageNames.join(', ')}. Built for ${opts.codeTemplate}.`,
    tags: [opts.codeTemplate, 'ecommerce', 'responsive', 'store', opts.niche.split(/\s+/)[0] ?? 'shop'].filter(
      Boolean,
    ) as string[],
    category: 'Ecommerce',
    suggestedPriceUsd: 49,
    compatibility: [opts.codeTemplate, 'HTML5', 'CSS3'],
    features: opts.pageNames.slice(0, 8),
  }

  if (!isGeminiEnabled()) return fallback

  try {
    const text = await generateAgentPlatformText(
      `Generate TemplateMonster listing JSON for:
Niche: ${opts.niche}
Platform: ${opts.codeTemplate}
Pages: ${opts.pageNames.join(', ')}
Return ONLY JSON: { title, shortDescription, description, tags[], category, suggestedPriceUsd, compatibility[], features[] }`,
      { temperature: 0.3, responseMimeType: 'application/json' },
    )
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1)) as MarketplaceListing
      return { ...fallback, ...parsed }
    }
  } catch {
    /* fallback */
  }
  return fallback
}

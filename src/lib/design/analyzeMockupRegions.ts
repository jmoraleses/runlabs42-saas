import 'server-only'

import { getDesignGenModelId } from '@/lib/ai/config.server'
import { resolveVertexAgentTextModelId } from '@/lib/ai/vertexModelAllowlist'
import { generateAgentPlatformText } from '@/lib/ai/vertexAgentPlatform'
import { parseRegionsFromModelText } from '@/lib/design/mockupRegionsParse'
import type { DesignPageMeta } from '@/lib/design/types'

const REGION_ANALYSIS_SYSTEM = `You analyze UI mockup screenshots and return ONLY valid JSON (no markdown, no prose).

Output format:
{
  "regions": [
    { "id": "nav", "label": "Navigation", "x": 0, "y": 0, "w": 1, "h": 0.08 }
  ]
}

Rules:
- x, y, w, h are normalized 0–1 relative to image dimensions (all must be > 0)
- Include 4–8 meaningful UI regions (nav, hero, CTA, cards, footer)
- Use short kebab-case ids
- Keep the response compact`

export { parseRegionsFromModelText } from '@/lib/design/mockupRegionsParse'

export async function analyzeMockupRegions(
  pngBase64: string,
  page: DesignPageMeta,
  modelId?: string,
): Promise<import('@/lib/design/types').DesignPageRegion[]> {
  const text = await generateAgentPlatformText(
    `Analyze this UI mockup for screen "${page.name}" (id: ${page.id}) and extract interactive UI regions.`,
    {
      model: resolveVertexAgentTextModelId(modelId, getDesignGenModelId()),
      systemInstruction: REGION_ANALYSIS_SYSTEM,
      temperature: 0.2,
      responseMimeType: 'application/json',
      images: [{ mimeType: 'image/png', data: pngBase64 }],
    },
  )

  const regions = parseRegionsFromModelText(text)
  if (!regions.length) {
    console.warn(
      `[analyzeMockupRegions] No se pudo parsear regiones para ${page.id}:`,
      text.slice(0, 240),
    )
  }
  return regions
}

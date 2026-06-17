import 'server-only'

import {
  generateDesignImagesProgressive,
  type GenerateDesignImagesProgressiveHandlers,
} from '@/lib/design/designImageGen'
import type { GeneratedImage } from '@/lib/ai/imageGen'
import type { OrchestrationAssetPlan } from '@/lib/design/orchestrationAssetsParse'

export {
  DESIGN_ASSETS_PLAN_PATH,
  parseAssetPlanFromModelText,
  assetPlanToFile,
  buildFallbackAssetPlan,
  formatPreGeneratedAssetsBlock,
  type OrchestrationAssetPlan,
  type OrchestrationAssetPlanItem,
} from '@/lib/design/orchestrationAssetsParse'

/** Ejecuta el plan de assets (equivalente a invocar la tool generate_design_asset). */
export async function executeOrchestrationAssetPlan(
  plan: OrchestrationAssetPlan,
  handlers: GenerateDesignImagesProgressiveHandlers,
): Promise<GeneratedImage[]> {
  if (!plan.assets.length) return []

  const pseudoHtml = plan.assets
    .map((a) => `[IMAGE: ${a.path} | ${a.prompt} | ${a.aspect ?? '16:9'}]`)
    .join('\n')

  return generateDesignImagesProgressive([pseudoHtml], handlers)
}

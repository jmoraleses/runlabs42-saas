import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { isGeminiEnabled, getAIProvider } from '@/lib/ai/config.server'
import { listModelsForClient } from '@/lib/ai/models'
import { listSelectableImageModelsForClient } from '@/lib/ai/imageModels'
import { getDesignAssetImageModelId } from '@/lib/platform/designImageModelSetting.server'
import { isDesignImageGenerationEnabled } from '@/lib/platform/designImageGenerationSetting.server'
import { createClient } from '@/lib/supabase/server'
import { mapVisibilityBucketsToChatCatalog } from '@/lib/ai/chatModelCategories'
import { mapVisibilityToChatCatalogIds } from '@/lib/ai/modelMenuVisibility'
import { loadModelMenuVisibilityFromDb } from '@/lib/platform/adminModelMenuVisibility.server'
import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/modelTypes'

export async function GET() {
  const geminiEnabled = isGeminiEnabled()
  const baseModels = listModelsForClient(geminiEnabled)
  let filteredModels = baseModels
  let visibilityForClient = mapVisibilityBucketsToChatCatalog({
    language: [],
    coding: [],
    ocr: [],
  })

  try {
    const supabase = await createClient()
    const visibilityRaw = await loadModelMenuVisibilityFromDb(supabase, [])
    visibilityForClient = mapVisibilityBucketsToChatCatalog(visibilityRaw)
    const visibleChatIds = mapVisibilityToChatCatalogIds(visibilityRaw)
    if (visibleChatIds.size > 0) {
      filteredModels = baseModels.filter(
        (m) => m.id === AUTO_MODEL_ID || m.id === MAX_MODEL_ID || visibleChatIds.has(m.id),
      )
    }
  } catch {
    // Sin Supabase: catálogo completo de chat.
  }

  const [defaultImageModelId, designImageGenerationEnabled] = await Promise.all([
    getDesignAssetImageModelId().catch(() => null),
    isDesignImageGenerationEnabled().catch(() => true),
  ])
  return NextResponse.json({
    provider: getAIProvider(),
    geminiEnabled,
    models: filteredModels,
    visibility: visibilityForClient,
    imageModels: listSelectableImageModelsForClient(),
    defaultImageModelId: defaultImageModelId ?? undefined,
    designImageGenerationEnabled,
  })
}

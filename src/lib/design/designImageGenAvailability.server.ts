import 'server-only'

import { trialDisablesDesignImageGeneration } from '@/lib/ai/genaiAppBuilderTrial'
import {
  getImageGenApiKey,
  imageGenAllowsApiKeyFallback,
  isVertexAIConfigured,
} from '@/lib/ai/config.server'
export type DesignImageGenBlockReason = 'trial' | 'admin' | 'vertex' | 'models'

/** Motivo por el que no se puede generar imagen (null = disponible). */
export async function getDesignImageGenBlockReason(): Promise<DesignImageGenBlockReason | null> {
  if (trialDisablesDesignImageGeneration()) return 'trial'

  const { isDesignImageGenerationEnabled } = await import(
    '@/lib/platform/designImageGenerationSetting.server'
  )
  if (!(await isDesignImageGenerationEnabled())) return 'admin'

  const hasApiKey = imageGenAllowsApiKeyFallback() && Boolean(getImageGenApiKey())
  if (!isVertexAIConfigured() && !hasApiKey) return 'vertex'

  if (isVertexAIConfigured()) {
    const { getDesignAssetGenModelCandidates } = await import('@/lib/ai/config.server')
    const candidates = await getDesignAssetGenModelCandidates()
    if (!candidates.length) return 'models'
  }

  return null
}

export async function shouldRunDesignImageGen(userRequested?: boolean): Promise<boolean> {
  if (!userRequested) return false
  return (await getDesignImageGenBlockReason()) === null
}

import 'server-only'

import { trialDisablesDesignImageGeneration } from '@/lib/ai/genaiAppBuilderTrial'
import { getDesignImageAdminSettings } from '@/lib/platform/designImageAdminSettings.server'

function envOverride(): boolean | null {
  if (trialDisablesDesignImageGeneration()) return false
  const raw = process.env.DESIGN_IMAGE_GENERATION_ENABLED?.trim().toLowerCase()
  if (raw === '1' || raw === 'true' || raw === 'yes') return true
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return null
}

/** Generación automática de imágenes (mockups, [IMAGE:], spec-kit). */
export async function isDesignImageGenerationEnabled(): Promise<boolean> {
  const fromEnv = envOverride()
  if (fromEnv !== null) return fromEnv
  const { enabled } = await getDesignImageAdminSettings()
  return enabled
}

export function invalidateDesignImageGenerationCache(): void {
  void import('@/lib/platform/designImageAdminSettings.server').then((m) =>
    m.invalidateDesignImageAdminSettingsCache(),
  )
}

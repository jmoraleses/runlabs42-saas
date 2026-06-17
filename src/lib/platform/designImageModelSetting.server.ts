import 'server-only'

import { resolveStableImageModelId } from '@/lib/ai/imageModels'
import { getDesignImageAdminSettings } from '@/lib/platform/designImageAdminSettings.server'

/** Modelo de imagen para assets de diseño (admin → env → Imagen 4 fast por defecto). */
export async function getDesignAssetImageModelId(): Promise<string> {
  const envOverride = process.env.DESIGN_ASSET_GEN_MODEL?.trim()
  if (envOverride) return resolveStableImageModelId(envOverride)
  const { modelId } = await getDesignImageAdminSettings()
  return resolveStableImageModelId(modelId)
}

/** Invalida caché tras guardar desde el panel admin. */
export function invalidateDesignImageModelCache(): void {
  void import('@/lib/platform/designImageAdminSettings.server').then((m) =>
    m.invalidateDesignImageAdminSettingsCache(),
  )
  void import('@/lib/ai/vertexImageModelProbe').then((m) =>
    m.invalidateVertexImageModelProbeCache(),
  )
}

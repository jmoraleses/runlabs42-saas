import { jsonError, ApiError } from '@/lib/api/errors'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import {
  listAdminSettings,
  upsertAdminSetting,
} from '@/lib/platform/adminSettings.server'
import { invalidateDesignImageModelCache } from '@/lib/platform/designImageModelSetting.server'
import { DESIGN_IMAGE_MODEL_SETTING_KEY } from '@/lib/platform/designImageModelSetting'
import { invalidateDesignImageGenerationCache } from '@/lib/platform/designImageGenerationSetting.server'
import { DESIGN_IMAGE_GENERATION_SETTING_KEY } from '@/lib/platform/designImageGenerationSetting'
import { migrateDesignImageAdminSettingsIfLegacy } from '@/lib/platform/designImageAdminSettings.server'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateDesignCloudOrchestratorCache } from '@/lib/platform/designCloudOrchestratorSetting.server'
import { DESIGN_CLOUD_ORCHESTRATOR_SETTING_KEY } from '@/lib/platform/designCloudOrchestratorSetting'
import { invalidateVertexGeminiBatchSettingsCache } from '@/lib/platform/vertexGeminiBatchSetting.server'
import { VERTEX_GEMINI_BATCH_SETTING_KEY } from '@/lib/platform/vertexGeminiBatchSetting'
import {
  invalidateVertexContextCacheSettingCache,
} from '@/lib/platform/vertexContextCacheSetting.server'
import { VERTEX_CONTEXT_CACHE_SETTING_KEY } from '@/lib/platform/vertexContextCacheSetting'

export { dynamic } from '@/lib/api/routeSegment'

export async function GET() {
  try {
    await requireAdmin()
    try {
      const admin = createAdminClient()
      await migrateDesignImageAdminSettingsIfLegacy(admin)
    } catch {
      /* Supabase admin no disponible en local */
    }
    const settings = await listAdminSettings()
    return Response.json({ settings })
  } catch (e) {
    return jsonError(e)
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { key, value } = body as { key: string; value: unknown }
    if (!key || typeof key !== 'string') {
      throw new ApiError(400, 'key requerido')
    }
    await upsertAdminSetting(key, value)
    if (key === DESIGN_IMAGE_MODEL_SETTING_KEY) {
      invalidateDesignImageModelCache()
    }
    if (key === DESIGN_IMAGE_GENERATION_SETTING_KEY) {
      invalidateDesignImageGenerationCache()
    }
    if (key === DESIGN_CLOUD_ORCHESTRATOR_SETTING_KEY) {
      invalidateDesignCloudOrchestratorCache()
    }
    if (key === VERTEX_GEMINI_BATCH_SETTING_KEY) {
      invalidateVertexGeminiBatchSettingsCache()
    }
    if (key === VERTEX_CONTEXT_CACHE_SETTING_KEY) {
      invalidateVertexContextCacheSettingCache()
    }
    return Response.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

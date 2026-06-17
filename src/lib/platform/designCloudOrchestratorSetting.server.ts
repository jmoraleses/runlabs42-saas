import 'server-only'

import {
  DEFAULT_DESIGN_CLOUD_ORCHESTRATOR_SETTING,
  DESIGN_CLOUD_ORCHESTRATOR_SETTING_KEY,
  parseDesignCloudOrchestratorSetting,
  type DesignCloudOrchestratorSetting,
} from '@/lib/platform/designCloudOrchestratorSetting'
import { createAdminClient } from '@/lib/supabase/admin'

const CACHE_TTL_MS = 15_000
let cached: { value: DesignCloudOrchestratorSetting; expiresAt: number } | null = null

export async function getDesignCloudOrchestratorSetting(): Promise<DesignCloudOrchestratorSetting> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.value

  let setting = { ...DEFAULT_DESIGN_CLOUD_ORCHESTRATOR_SETTING }
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('admin_settings')
      .select('value')
      .eq('key', DESIGN_CLOUD_ORCHESTRATOR_SETTING_KEY)
      .maybeSingle()
    if (data?.value !== undefined) {
      setting = parseDesignCloudOrchestratorSetting(data.value)
    }
  } catch {
    /* Supabase no configurado en local */
  }

  cached = { value: setting, expiresAt: now + CACHE_TTL_MS }
  return setting
}

export async function saveDesignCloudOrchestratorSetting(
  patch: Partial<DesignCloudOrchestratorSetting>,
): Promise<DesignCloudOrchestratorSetting> {
  const current = await getDesignCloudOrchestratorSetting()
  const next: DesignCloudOrchestratorSetting = {
    ...current,
    ...patch,
  }
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('admin_upsert_setting', {
      p_key: DESIGN_CLOUD_ORCHESTRATOR_SETTING_KEY,
      p_value: next,
    })
    if (error) throw new Error(error.message)
  } catch (err) {
    /* Supabase no configurado en local: actualizar solo caché en memoria */
    if (!(err instanceof Error) || !/SUPABASE|Missing/.test(err.message)) {
      throw err
    }
  }
  cached = { value: next, expiresAt: Date.now() + CACHE_TTL_MS }
  return next
}

export function invalidateDesignCloudOrchestratorCache(): void {
  cached = null
}

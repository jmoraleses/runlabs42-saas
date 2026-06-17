import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_DESIGN_IMAGE_GENERATION_SETTING,
  DESIGN_IMAGE_GENERATION_SETTING_KEY,
  parseDesignImageGenerationEnabled,
} from '@/lib/platform/designImageGenerationSetting'
import {
  DEFAULT_DESIGN_IMAGE_MODEL_SETTING,
  DESIGN_IMAGE_MODEL_SETTING_KEY,
  LEGACY_DESIGN_IMAGE_MODEL_IDS,
  parseDesignImageModelSetting,
} from '@/lib/platform/designImageModelSetting'
import { resolveStableImageModelId } from '@/lib/ai/imageModels'

export type DesignImageAdminSettings = {
  enabled: boolean
  modelId: string
}

const CACHE_TTL_MS = 30_000
let cached: { value: DesignImageAdminSettings; expiresAt: number } | null = null

function rawModelIdFromSetting(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'modelId' in value) {
    const raw = (value as { modelId?: unknown }).modelId
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null
  }
  return null
}

function isLegacyModelValue(value: unknown): boolean {
  const raw = rawModelIdFromSetting(value)
  if (!raw) return false
  return LEGACY_DESIGN_IMAGE_MODEL_IDS.has(resolveStableImageModelId(raw))
}

/** Persiste defaults actuales si faltan filas o guardan valores legacy del admin antiguo. */
export async function migrateDesignImageAdminSettingsIfLegacy(
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  const { data: rows } = await admin
    .from('admin_settings')
    .select('key, value')
    .in('key', [DESIGN_IMAGE_GENERATION_SETTING_KEY, DESIGN_IMAGE_MODEL_SETTING_KEY])

  const byKey = new Map((rows ?? []).map((row) => [row.key, row.value]))
  const genRaw = byKey.get(DESIGN_IMAGE_GENERATION_SETTING_KEY)
  const modelRaw = byKey.get(DESIGN_IMAGE_MODEL_SETTING_KEY)

  const nextGen = { ...DEFAULT_DESIGN_IMAGE_GENERATION_SETTING }
  const nextModel = { ...DEFAULT_DESIGN_IMAGE_MODEL_SETTING }

  let migrated = false

  const needModel = modelRaw === undefined || isLegacyModelValue(modelRaw)
  if (needModel) {
    const { error } = await admin.rpc('admin_upsert_setting', {
      p_key: DESIGN_IMAGE_MODEL_SETTING_KEY,
      p_value: nextModel,
    })
    if (error) throw new Error(error.message)
    migrated = true
  }

  const genDisabled =
    genRaw !== undefined && parseDesignImageGenerationEnabled(genRaw) === false
  const needGen =
    genRaw === undefined ||
    (genDisabled && (modelRaw === undefined || isLegacyModelValue(modelRaw)))

  if (needGen) {
    const { error } = await admin.rpc('admin_upsert_setting', {
      p_key: DESIGN_IMAGE_GENERATION_SETTING_KEY,
      p_value: nextGen,
    })
    if (error) throw new Error(error.message)
    migrated = true
  }

  if (migrated) cached = null

  return migrated
}

export async function getDesignImageAdminSettings(): Promise<DesignImageAdminSettings> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.value

  let enabled = DEFAULT_DESIGN_IMAGE_GENERATION_SETTING.enabled
  let modelId = DEFAULT_DESIGN_IMAGE_MODEL_SETTING.modelId

  try {
    const admin = createAdminClient()
    await migrateDesignImageAdminSettingsIfLegacy(admin)

    const { data: rows } = await admin
      .from('admin_settings')
      .select('key, value')
      .in('key', [DESIGN_IMAGE_GENERATION_SETTING_KEY, DESIGN_IMAGE_MODEL_SETTING_KEY])

    for (const row of rows ?? []) {
      if (row.key === DESIGN_IMAGE_GENERATION_SETTING_KEY && row.value !== undefined) {
        enabled = parseDesignImageGenerationEnabled(row.value)
      }
      if (row.key === DESIGN_IMAGE_MODEL_SETTING_KEY && row.value !== undefined) {
        modelId = parseDesignImageModelSetting(row.value).modelId
      }
    }
  } catch {
    /* Supabase no configurado en local */
  }

  const value = { enabled, modelId }
  cached = { value, expiresAt: now + CACHE_TTL_MS }
  return value
}

export function invalidateDesignImageAdminSettingsCache(): void {
  cached = null
}

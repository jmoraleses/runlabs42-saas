import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_VERTEX_GEMINI_BATCH_SETTING,
  parseVertexGeminiBatchEnabled,
  VERTEX_GEMINI_BATCH_SETTING_KEY,
} from '@/lib/platform/vertexGeminiBatchSetting'

const CACHE_TTL_MS = 30_000
let cached: { value: boolean; expiresAt: number } | null = null

export async function isVertexGeminiBatchApiEnabled(): Promise<boolean> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.value

  let enabled = DEFAULT_VERTEX_GEMINI_BATCH_SETTING.enabled
  try {
    const admin = createAdminClient()
    const { data: row } = await admin
      .from('admin_settings')
      .select('value')
      .eq('key', VERTEX_GEMINI_BATCH_SETTING_KEY)
      .maybeSingle()
    if (row?.value !== undefined) {
      enabled = parseVertexGeminiBatchEnabled(row.value)
    }
  } catch {
    /* Supabase no configurado en local */
  }

  cached = { value: enabled, expiresAt: now + CACHE_TTL_MS }
  return enabled
}

export function invalidateVertexGeminiBatchSettingsCache(): void {
  cached = null
}

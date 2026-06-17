import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_VERTEX_CONTEXT_CACHE_SETTING,
  parseVertexContextCacheSetting,
  VERTEX_CONTEXT_CACHE_SETTING_KEY,
  type VertexContextCacheSetting,
} from '@/lib/platform/vertexContextCacheSetting'

const CACHE_TTL_MS = 30_000

let cached: { value: VertexContextCacheSetting; expiresAt: number } | null = null

export async function getVertexContextCacheSetting(): Promise<VertexContextCacheSetting> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.value

  let value = { ...DEFAULT_VERTEX_CONTEXT_CACHE_SETTING }
  try {
    const admin = createAdminClient()
    const { data: row } = await admin
      .from('admin_settings')
      .select('value')
      .eq('key', VERTEX_CONTEXT_CACHE_SETTING_KEY)
      .maybeSingle()
    if (row?.value !== undefined) {
      value = parseVertexContextCacheSetting(row.value)
    }
  } catch {
    /* Supabase no configurado en local */
  }

  cached = { value, expiresAt: now + CACHE_TTL_MS }
  return value
}

export function invalidateVertexContextCacheSettingCache(): void {
  cached = null
}

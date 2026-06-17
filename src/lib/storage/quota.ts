import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/errors'
import { userStorageLimitBytes } from './config'

export async function getBytesUsed(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_storage_usage')
    .select('bytes_used')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new ApiError(500, error.message)
  return Number(data?.bytes_used ?? 0)
}

export async function adjustQuota(
  supabase: SupabaseClient,
  userId: string,
  deltaBytes: number,
): Promise<void> {
  if (deltaBytes === 0) return

  const current = await getBytesUsed(supabase, userId)
  const next = current + deltaBytes
  const limit = userStorageLimitBytes()

  if (deltaBytes > 0 && next > limit) {
    const limitMb = Math.round(limit / (1024 * 1024))
    throw new ApiError(
      413,
      `Has alcanzado el límite de almacenamiento (${limitMb} MB). Elimina archivos o contacta soporte.`,
    )
  }

  if (next < 0) {
    const { error } = await supabase.from('user_storage_usage').upsert({
      user_id: userId,
      bytes_used: 0,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new ApiError(500, error.message)
    return
  }

  const { error } = await supabase.from('user_storage_usage').upsert({
    user_id: userId,
    bytes_used: next,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new ApiError(500, error.message)
}

export async function checkQuotaForUpload(
  supabase: SupabaseClient,
  userId: string,
  newBytes: number,
  previousBytes = 0,
): Promise<void> {
  const delta = newBytes - previousBytes
  if (delta <= 0) return
  const current = await getBytesUsed(supabase, userId)
  const limit = userStorageLimitBytes()
  if (current + delta > limit) {
    const limitMb = Math.round(limit / (1024 * 1024))
    throw new ApiError(
      413,
      `Has alcanzado el límite de almacenamiento (${limitMb} MB). Elimina archivos o contacta soporte.`,
    )
  }
}

import 'server-only'

import { ApiError } from '@/lib/api/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function isMissingRpc(error: { message?: string }, fnName: string): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('could not find the function') && msg.includes(fnName.toLowerCase())
}

type AdminSettingRow = { key: string; value: unknown }

/** Lee admin_settings con service role, RPC SECURITY DEFINER o SELECT directo. */
export async function listAdminSettings(): Promise<Record<string, unknown>> {
  const settings: Record<string, unknown> = {}

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('admin_settings').select('key, value')
    if (!error) {
      for (const row of data ?? []) {
        settings[row.key] = row.value
      }
      return settings
    }
  } catch {
    /* Sin service role en local: continuar con RPC / sesión */
  }

  const supabase = await createClient()
  const { data: rpcRows, error: rpcError } = await supabase.rpc('admin_list_settings')
  if (!rpcError && Array.isArray(rpcRows)) {
    for (const row of rpcRows as AdminSettingRow[]) {
      if (row?.key) settings[row.key] = row.value
    }
    return settings
  }

  if (rpcError && !isMissingRpc(rpcError, 'admin_list_settings')) {
    const { data, error } = await supabase.from('admin_settings').select('key, value')
    if (error) throw new ApiError(500, error.message)
    for (const row of data ?? []) {
      settings[row.key] = row.value
    }
    return settings
  }

  return settings
}

/** Persiste un ajuste admin (funciona con demo/anon vía RPC SECURITY DEFINER). */
export async function upsertAdminSetting(key: string, value: unknown): Promise<void> {
  const p_value = value as Record<string, unknown>

  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('admin_upsert_setting', { p_key: key, p_value })
    if (!error) return

    if (!isMissingRpc(error, 'admin_upsert_setting')) {
      throw new ApiError(500, error.message)
    }

    const { error: upsertError } = await admin
      .from('admin_settings')
      .upsert(
        { key, value: p_value, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
    if (!upsertError) return
    throw new ApiError(500, upsertError.message)
  } catch (err) {
    if (err instanceof ApiError) throw err
    /* Sin service role: usar RPC con la sesión actual (incl. demo/anon). */
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_upsert_setting', { p_key: key, p_value })
  if (error) {
    throw new ApiError(
      500,
      `${error.message}. Aplica la migración 029_admin_settings.sql en Supabase.`,
    )
  }
}

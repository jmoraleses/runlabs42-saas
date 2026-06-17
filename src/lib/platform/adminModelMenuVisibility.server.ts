import 'server-only'

import {
  EMPTY_MODEL_MENU_VISIBILITY,
  MODEL_MENU_VISIBILITY_SETTING_KEY,
  parseModelMenuVisibility,
  type ModelMenuVisibility,
} from '@/lib/ai/modelMenuVisibility'
import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

function isMissingRpc(error: { message?: string }, fnName: string): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('could not find the function') && msg.includes(fnName.toLowerCase())
}

export async function loadModelMenuVisibilityFromDb(
  supabase: SupabaseClient,
  validModelIds: string[] = [],
): Promise<ModelMenuVisibility> {
  const { data: rpcValue, error: rpcError } = await supabase.rpc('admin_get_model_menu_visibility')
  if (!rpcError && rpcValue) {
    return parseModelMenuVisibility(rpcValue, validModelIds)
  }
  if (rpcError && !isMissingRpc(rpcError, 'admin_get_model_menu_visibility')) {
    /* Continuar con lectura directa si la RPC falla por otro motivo. */
  }

  const { data, error } = await supabase
    .from('admin_model_menu_visibility')
    .select('value')
    .eq('id', 'default')
    .maybeSingle()

  if (!error && data?.value) {
    return parseModelMenuVisibility(data.value, validModelIds)
  }

  const { data: legacy, error: legacyError } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', MODEL_MENU_VISIBILITY_SETTING_KEY)
    .maybeSingle()

  if (!legacyError && legacy?.value) {
    return parseModelMenuVisibility(legacy.value, validModelIds)
  }

  return parseModelMenuVisibility(null, validModelIds)
}

export async function saveModelMenuVisibilityToDb(
  supabase: SupabaseClient,
  visibility: ModelMenuVisibility,
): Promise<void> {
  const { error } = await supabase.rpc('admin_upsert_model_menu_visibility', {
    p_value: visibility,
  })
  if (error) {
    throw new Error(
      `${error.message}. Aplica la migración 026_admin_model_menu_visibility.sql en Supabase.`,
    )
  }

  const { error: legacyError } = await supabase.rpc('admin_upsert_setting', {
    p_key: MODEL_MENU_VISIBILITY_SETTING_KEY,
    p_value: visibility,
  })
  if (legacyError) {
    /* Compatibilidad: admin_settings puede no existir en todos los entornos. */
  }
}

export { EMPTY_MODEL_MENU_VISIBILITY }

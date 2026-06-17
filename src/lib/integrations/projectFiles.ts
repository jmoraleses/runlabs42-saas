import type { SupabaseClient } from '@supabase/supabase-js'
import { createUserSupabaseClient } from './userSupabase'
import type { UserIntegrationRow } from './types'

/** @deprecated Usar requireUserFilesClient en rutas de archivos. */
export async function getProjectFilesClient(
  platformSupabase: SupabaseClient,
  userId: string,
  integration: UserIntegrationRow | null,
): Promise<{ client: SupabaseClient; provider: 'user_supabase' | 'platform' }> {
  if (integration?.supabase_url && integration.supabase_service_role_enc) {
    return { client: createUserSupabaseClient(integration), provider: 'user_supabase' }
  }
  return { client: platformSupabase, provider: 'platform' }
}

export async function loadFilesClient(platformSupabase: SupabaseClient, userId: string) {
  const { data: integration } = await platformSupabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return getProjectFilesClient(platformSupabase, userId, integration as UserIntegrationRow | null)
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/errors'
import { mapIntegrationStatus } from './status'
import type { UserIntegrationRow } from './types'

export async function requireUserIntegrations(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new ApiError(500, 'No se pudo comprobar las integraciones')
  const status = mapIntegrationStatus(data as UserIntegrationRow | null)
  if (!status.ready) {
    throw new ApiError(
      403,
      'Conecta tu cuenta de Supabase y Vercel en Ajustes → Integraciones antes de crear proyectos.',
    )
  }
  return { row: data as UserIntegrationRow, status }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret } from './crypto'
import type { UserIntegrationRow } from './types'

export function createUserSupabaseClient(row: UserIntegrationRow): SupabaseClient {
  if (!row.supabase_url || !row.supabase_service_role_enc) {
    throw new Error('Supabase del usuario no conectado')
  }
  const serviceRole = decryptSecret(row.supabase_service_role_enc)
  return createClient(row.supabase_url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function validateUserSupabase(
  url: string,
  serviceRoleKey: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const client = createClient(url.replace(/\/$/, ''), serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await client.from('project_files').select('id').limit(1)
    if (error?.code === '42P01') {
      return {
        ok: false,
        message:
          'Falta la tabla project_files. Ejecuta supabase/user-project-schema.sql en tu proyecto Supabase.',
      }
    }
    if (error) return { ok: false, message: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Conexión fallida' }
  }
}

export function extractSupabaseProjectRef(url: string): string | null {
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)
  return m?.[1] ?? null
}

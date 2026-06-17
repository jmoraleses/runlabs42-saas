import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Cliente Supabase para rutas /api/admin/*: service role si está disponible
 * (lee/escribe tablas admin con RLS solo para authenticated, p. ej. modo demo).
 */
export async function createAdminRouteClient(): Promise<SupabaseClient> {
  try {
    return createAdminClient()
  } catch {
    return createClient()
  }
}

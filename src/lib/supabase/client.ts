import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'

let browserClient: SupabaseClient | null = null

/** Cliente navegador; `null` si faltan NEXT_PUBLIC_SUPABASE_* (p. ej. solo Gemini local). */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return browserClient
}

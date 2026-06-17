import { createClient } from '@/lib/supabase/server'
import { ApiError } from '@/lib/api/errors'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { User } from '@supabase/supabase-js'

export async function requireUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  user: User
}> {
  if (!isSupabaseConfigured()) {
    throw new ApiError(401, 'No autorizado')
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new ApiError(401, 'No autorizado')
  }

  return { supabase, user }
}

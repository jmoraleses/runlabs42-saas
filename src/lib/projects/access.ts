import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/errors'

/** Owner-only access. Ignores `projects.public`; projects are never shared via RLS. */
export async function requireProjectAccess(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, user_id, name, framework')
    .eq('id', projectId)
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .single()

  if (error || !data) throw new ApiError(404, 'Proyecto no encontrado')
  return data
}

export function inferLanguage(path: string): string {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript'
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.md')) return 'markdown'
  if (path.endsWith('.html')) return 'html'
  return 'plaintext'
}

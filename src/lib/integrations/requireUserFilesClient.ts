import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/errors'
import { getProjectFilesStore } from '@/lib/storage/projectFiles'

/**
 * @deprecated Usar requireProjectFilesStore(supabase, userId, projectId).
 * Mantenido temporalmente para compatibilidad; requiere projectId en contexto de ruta.
 */
export async function requireUserFilesClient(
  supabase: SupabaseClient,
  userId: string,
  projectId?: string,
) {
  if (!projectId) {
    throw new ApiError(500, 'projectId requerido para acceso a archivos')
  }
  return { store: getProjectFilesStore(supabase, userId, projectId) }
}

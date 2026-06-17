import type { SupabaseClient } from '@supabase/supabase-js'
import { getProjectFilesStore, type ProjectFilesStore } from './projectFiles'

/** Acceso a archivos de proyecto en almacenamiento de plataforma (Supabase + Vercel Blob). */
export function requireProjectFilesStore(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): ProjectFilesStore {
  return getProjectFilesStore(supabase, userId, projectId)
}

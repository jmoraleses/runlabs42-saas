import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { ApiError } from '@/lib/api/errors'
import { isDemoProjectId } from '@/lib/auth/demo-server'
import { isDemoCookieValue, isDemoStreamAllowed } from '@/lib/auth/demo-stream'
import { requireUser } from '@/lib/auth/requireUser'
import { requireProjectAccess } from '@/lib/projects/access'
import {
  DemoProjectFilesStore,
  getDemoProjectFilesStore,
  isDemoFilesystemBackend,
} from './demoProjectFilesStore'
import { getProjectFilesStore, type ProjectFilesStore } from './projectFiles'
import { isBlobStorageEnabled } from './config'

export type ProjectFilesContext =
  | { mode: 'demo'; store: DemoProjectFilesStore }
  | {
      mode: 'db'
      store: ProjectFilesStore
      supabase: SupabaseClient
      user: User
    }

async function allowDemoProjectFiles(projectId: string): Promise<boolean> {
  if (!isDemoProjectId(projectId)) return false
  if (isDemoFilesystemBackend()) return true
  if (isBlobStorageEnabled()) return true
  const demoCookie = isDemoCookieValue((await cookies()).get('runlabs_demo')?.value)
  return !!(demoCookie && isDemoStreamAllowed())
}

/** Proyectos demo: `.data/local-projects/` en dev, Vercel Blob en despliegue. */
export async function requireProjectFilesContext(
  projectId: string,
): Promise<ProjectFilesContext> {
  if (await allowDemoProjectFiles(projectId)) {
    return { mode: 'demo', store: getDemoProjectFilesStore(projectId) }
  }

  if (isDemoProjectId(projectId)) {
    throw new ApiError(
      503,
      'Almacenamiento demo no disponible (configura BLOB_READ_WRITE_TOKEN en Vercel)',
    )
  }

  const { supabase, user } = await requireUser()
  await requireProjectAccess(supabase, projectId, user.id)
  return {
    mode: 'db',
    store: getProjectFilesStore(supabase, user.id, projectId),
    supabase,
    user,
  }
}

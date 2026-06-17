import { cookies } from 'next/headers'
import { isDemoCookieValue, isDemoStreamAllowed } from '@/lib/auth/demo-stream'
import { isDemoProjectId } from '@/lib/auth/demo-server'
import { requireUser } from '@/lib/auth/requireUser'
import { isLocalMemoryDev } from '@/lib/studio/localMemoryStore'
import type { User } from '@supabase/supabase-js'

export type MemoryAuth =
  | { kind: 'demo' }
  | { kind: 'local' }
  | {
      kind: 'user'
      supabase: Awaited<ReturnType<typeof requireUser>>['supabase']
      user: User
    }

async function hasDemoSession(): Promise<boolean> {
  const demoCookie = isDemoCookieValue((await cookies()).get('runlabs_demo')?.value)
  return demoCookie && isDemoStreamAllowed()
}

function localMemoryAuth(): MemoryAuth {
  return isLocalMemoryDev() ? { kind: 'local' } : { kind: 'demo' }
}

/** Supabase en producción; en local/demo persiste en `.data/local-memories/`. */
export async function requireMemoryUser(
  projectId?: string | null,
): Promise<MemoryAuth> {
  if (await hasDemoSession()) return localMemoryAuth()

  if (projectId && isDemoProjectId(projectId)) {
    try {
      const auth = await requireUser()
      return { kind: 'user', ...auth }
    } catch {
      return localMemoryAuth()
    }
  }

  const auth = await requireUser()
  return { kind: 'user', ...auth }
}

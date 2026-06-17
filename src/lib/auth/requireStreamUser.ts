import { cookies, headers } from 'next/headers'
import { ApiError } from '@/lib/api/errors'
import { DEMO_USER_EMAIL, DEMO_USER_ID } from '@/lib/auth/demo-server'
import { isDemoCookieValue, isDemoStreamAllowed } from '@/lib/auth/demo-stream'
import { requireUser } from '@/lib/auth/requireUser'
import { isSupabaseConfigured } from '@/lib/supabase/config'

type StreamUser = { id: string; email?: string | null }

function demoStreamUser(): { user: StreamUser } {
  return { user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL } }
}

function isGuestStreamAllowed(): boolean {
  return process.env.ALLOW_GUEST_STREAM === '1'
}

async function guestStreamUser(): Promise<{ user: StreamUser }> {
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  return { user: { id: `guest-${ip}`, email: null } }
}

/**
 * Sesión Supabase real. Con ALLOW_GUEST_STREAM=1 (test mode), permite acceso sin auth.
 */
export async function requireStreamUser(): Promise<{ user: StreamUser }> {
  const demoCookie = isDemoCookieValue((await cookies()).get('runlabs_demo')?.value)

  if (demoCookie && isDemoStreamAllowed()) {
    return demoStreamUser()
  }

  if (isSupabaseConfigured()) {
    try {
      const { user } = await requireUser()
      return { user: { id: String(user.id), email: user.email } }
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e
      // Fall through to guest check if stream auth not satisfied
    }
  }

  if (isGuestStreamAllowed()) {
    return guestStreamUser()
  }

  if (
    isDemoStreamAllowed() &&
    process.env.NODE_ENV === 'development' &&
    !isSupabaseConfigured()
  ) {
    return demoStreamUser()
  }

  throw new ApiError(401, 'No autorizado')
}

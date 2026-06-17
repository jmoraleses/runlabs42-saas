import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/errors'
import { isAdminEmail } from '@/lib/auth/adminEmails'
import { DEMO_USER_EMAIL, DEMO_USER_ID } from '@/lib/auth/demo-server'
import { isDemoCookieValue, isDemoStreamAllowed } from '@/lib/auth/demo-stream'
import { requireUser } from '@/lib/auth/requireUser'

function demoAdminUser(): User {
  return {
    id: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    app_metadata: { provider: 'demo', providers: ['demo'] },
    user_metadata: { full_name: 'Usuario Demo' },
    aud: 'authenticated',
    created_at: new Date(0).toISOString(),
  } as User
}

/** Sesión admin: Supabase real o cuenta demo local en desarrollo. */
export async function requireAdmin(): Promise<User> {
  const demoCookie = isDemoCookieValue((await cookies()).get('runlabs_demo')?.value)
  if (
    demoCookie &&
    isDemoStreamAllowed() &&
    process.env.NODE_ENV === 'development' &&
    isAdminEmail(DEMO_USER_EMAIL)
  ) {
    return demoAdminUser()
  }

  const { user } = await requireUser()
  if (!isAdminEmail(user.email)) {
    throw new ApiError(403, 'Acceso restringido')
  }
  return user
}

import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(request: Request) {
  try {
    const { user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'account-delete'), 3, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw new ApiError(500, error.message)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

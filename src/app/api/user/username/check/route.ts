import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUsernameFormat, normalizeUsername } from '@/lib/user/username'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'

export async function GET(request: Request) {
  try {
    const { user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'username-check'), 40, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const { searchParams } = new URL(request.url)
    const username = normalizeUsername(searchParams.get('username') ?? '')

    if (!username) {
      return NextResponse.json({ available: false, reason: 'empty' })
    }

    if (!isValidUsernameFormat(username)) {
      return NextResponse.json({ available: false, reason: 'invalid' })
    }

    const admin = createAdminClient()
    const { data: row } = await admin
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    const taken = Boolean(row && row.id !== user.id)
    return NextResponse.json({
      available: !taken,
      reason: taken ? 'taken' : 'ok',
      username,
    })
  } catch (e) {
    return jsonError(e)
  }
}

import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { isValidUsernameFormat, normalizeUsername } from '@/lib/user/username'

function mapProfileRow(data: {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  username: string | null
  plan: string
  credits: number
  settings: unknown
  subscription_status?: string | null
  subscription_period_end?: string | null
  stripe_customer_id?: string | null
}) {
  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
    bio: data.bio,
    username: data.username,
    plan: data.plan,
    credits: data.credits,
    settings: data.settings,
    subscriptionStatus: data.subscription_status ?? 'none',
    subscriptionPeriodEnd: data.subscription_period_end ?? null,
    hasStripeCustomer: !!data.stripe_customer_id,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertUsernameAvailable(
  supabase: any,
  username: string,
  userId: string,
) {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (existing && existing.id !== userId) {
    throw new ApiError(409, 'Este nombre de usuario ya está en uso')
  }
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'profile'), 60)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')
    const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (error) throw new ApiError(500, error.message)
    return NextResponse.json({ profile: mapProfileRow(data) })
  } catch (e) {
    return jsonError(e)
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'profile'), 30, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.fullName != null) updates.full_name = String(body.fullName).trim() || null
    if (body.avatarUrl != null) updates.avatar_url = body.avatarUrl
    if (body.bio != null) updates.bio = String(body.bio).trim() || null
    if (body.settings != null) updates.settings = body.settings

    if (body.username !== undefined) {
      const username = normalizeUsername(String(body.username ?? ''))
      if (!username) {
        updates.username = null
      } else {
        if (!isValidUsernameFormat(username)) {
          throw new ApiError(400, 'Nombre de usuario no válido')
        }
        await assertUsernameAvailable(supabase, username, user.id)
        updates.username = username
      }
    }

    const { data: existing } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle()

    let data
    let error

    if (existing) {
      ;({ data, error } = await supabase.from('users').update(updates).eq('id', user.id).select().single())
    } else {
      // Read initial credits from admin_settings (set by admin panel)
      const { data: setting } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'signup_credits')
        .maybeSingle()
      const creditConfig = setting?.value as { creditsOnRegister?: number } | null
      const initialCredits = creditConfig?.creditsOnRegister ?? 10

      ;({ data, error } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email ?? '',
          full_name: updates.full_name ?? null,
          avatar_url: updates.avatar_url ?? null,
          bio: updates.bio ?? null,
          settings: updates.settings ?? { theme: 'dark', language: 'en', notifications: true },
          credits: initialCredits,
        })
        .select()
        .single())
    }

    if (error) throw new ApiError(500, error.message)
    return NextResponse.json({ ok: true, profile: mapProfileRow(data) })
  } catch (e) {
    return jsonError(e)
  }
}

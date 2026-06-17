import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { createHash, randomBytes } from 'crypto'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'

function hashKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'api-keys'), 60)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw new ApiError(500, error.message)
    return NextResponse.json({ keys: data ?? [] })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const body = await request.json()
    const name = String(body.name ?? 'Clave API').trim()
    if (!name) throw new ApiError(400, 'Nombre requerido')

    const raw = `rl42_${randomBytes(24).toString('hex')}`
    const prefix = raw.slice(0, 12)
    const keyHash = hashKey(raw)

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        name,
        key_prefix: prefix,
        key_hash: keyHash,
      })
      .select('id, name, key_prefix, created_at')
      .single()

    if (error) throw new ApiError(500, error.message)
    return NextResponse.json({ key: data, secret: raw }, { status: 201 })
  } catch (e) {
    return jsonError(e)
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) throw new ApiError(400, 'ID requerido')

    const { error } = await supabase.from('api_keys').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw new ApiError(500, error.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

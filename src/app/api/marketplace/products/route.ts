import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { mapProduct } from '@/lib/db/mappers'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'

export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(null, ip, 'marketplace-list'), 120)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('marketplace_products')
      .select(
        `
        *,
        creator:users!creator_id (
          full_name,
          email,
          avatar_url
        )
      `,
      )
      .not('published_at', 'is', null)
      .order('downloads', { ascending: false })

    if (error) throw new ApiError(500, error.message)

    const products = (data ?? []).map((row) => {
      const base = mapProduct(row as Record<string, unknown>)
      const creator = row.creator as { full_name?: string; email?: string } | null
      const handle =
        creator?.email?.split('@')[0] ||
        creator?.full_name?.toLowerCase().replace(/\s+/g, '-') ||
        'creator'
      return {
        ...base,
        author: `@${handle}`,
        authorName: creator?.full_name ?? handle,
        price: base.priceCredits,
        stars: base.downloads,
        ratings: Math.max(1, Math.floor(base.downloads / 10)),
        tags: row.category ? String(row.category).split(',').map((t) => t.trim()) : [],
        desc: base.description ?? '',
      }
    })

    return NextResponse.json({ products })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'marketplace-publish'), 20, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')
    const body = await request.json()
    const name = String(body.name ?? '').trim()
    if (!name) throw new ApiError(400, 'El nombre es obligatorio')

    const previewUrl = body.previewUrl ? String(body.previewUrl) : null
    const coverImages = Array.isArray(body.coverImages)
      ? (body.coverImages as unknown[]).map(String).filter(Boolean)
      : previewUrl
        ? [previewUrl]
        : null
    if (!coverImages?.length) throw new ApiError(400, 'Debes subir al menos una imagen de portada')

    const { data, error } = await supabase
      .from('marketplace_products')
      .insert({
        creator_id: user.id,
        name,
        description: body.description ?? null,
        category: body.category ?? null,
        framework: body.framework ?? 'next',
        github_repo: body.githubRepo ?? null,
        price_credits: Number(body.priceCredits ?? 0),
        preview_url: previewUrl ?? coverImages?.[0] ?? null,
        cover_images: coverImages,
        published_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw new ApiError(500, error.message)

    const projectId = body.projectId ? String(body.projectId) : null
    if (projectId) {
      await supabase
        .from('projects')
        .update({ marketplace_listed: true, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ product: mapProduct(data) }, { status: 201 })
  } catch (e) {
    return jsonError(e)
  }
}

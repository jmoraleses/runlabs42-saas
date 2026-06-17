import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { createClient } from '@/lib/supabase/server'
import { jsonError, ApiError } from '@/lib/api/errors'
import { mapProduct } from '@/lib/db/mappers'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
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
      .eq('id', id)
      .not('published_at', 'is', null)
      .single()

    if (error || !data) throw new ApiError(404, 'Producto no encontrado')

    const base = mapProduct(data as Record<string, unknown>)
    const creator = data.creator as { full_name?: string; email?: string; avatar_url?: string } | null
    const handle =
      creator?.email?.split('@')[0] ||
      creator?.full_name?.toLowerCase().replace(/\s+/g, '-') ||
      'creator'

    return NextResponse.json({
      product: {
        ...base,
        author: `@${handle}`,
        authorName: creator?.full_name ?? handle,
        authorAvatar: creator?.avatar_url ?? null,
        price: base.priceCredits,
        stars: base.downloads,
        desc: base.description ?? '',
        githubRepo: (data as Record<string, unknown>).github_repo ?? null,
        framework: String((data as Record<string, unknown>).framework ?? 'next'),
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}

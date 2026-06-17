import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'marketplace-purchase'), 30, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')
    const { productId } = await request.json()
    if (!productId) throw new ApiError(400, 'productId es obligatorio')

    const { data: product, error: pErr } = await supabase
      .from('marketplace_products')
      .select('id, price_credits, creator_id')
      .eq('id', productId)
      .single()

    if (pErr || !product) throw new ApiError(404, 'Producto no encontrado')
    if (product.creator_id === user.id) {
      throw new ApiError(400, 'No puedes comprar tu propio producto')
    }

    const price = product.price_credits ?? 0
    if (price > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient()
      const { data: ok } = await admin.rpc('deducir_creditos', {
        p_user_id: user.id,
        p_amount: price,
        p_description: `Marketplace purchase ${productId}`,
      })
      if (!ok) throw new ApiError(402, 'Créditos insuficientes')
    }

    const { error: insErr } = await supabase.from('marketplace_purchases').insert({
      user_id: user.id,
      product_id: productId,
    })

    if (insErr?.code === '23505') throw new ApiError(409, 'Ya compraste este producto')
    if (insErr) throw new ApiError(500, insErr.message)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

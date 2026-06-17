import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'

export async function GET() {
  try {
    const { supabase, user } = await requireUser()
    const { data, error } = await supabase
      .from('marketplace_purchases')
      .select(
        `
        id,
        purchased_at,
        product:marketplace_products (
          id,
          name,
          description,
          framework,
          price_credits,
          github_repo
        )
      `,
      )
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false })

    if (error) throw new ApiError(500, error.message)
    return NextResponse.json({ purchases: data ?? [] })
  } catch (e) {
    return jsonError(e)
  }
}

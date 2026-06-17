import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'

export async function GET() {
  try {
    const { supabase, user } = await requireUser()
    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, type, description, model, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw new ApiError(500, error.message)

    return NextResponse.json({
      transactions: (data ?? []).map((row) => ({
        id: row.id,
        amount: row.amount,
        type: row.type,
        description: row.description,
        model: row.model,
        createdAt: row.created_at,
      })),
    })
  } catch (e) {
    return jsonError(e)
  }
}

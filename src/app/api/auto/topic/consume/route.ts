import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireUser } from '@/lib/auth/requireUser'

export async function POST(request: Request) {
  try {
    await requireStreamUser()
    const { supabase, user } = await requireUser()
    const body = (await request.json().catch(() => ({}))) as { itemIds?: unknown[] }
    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.map((x) => String(x).trim()).filter(Boolean)
      : []
    if (!itemIds.length) throw new ApiError(400, 'itemIds es requerido')

    const { error } = await supabase
      .from('auto_topic_items')
      .update({ status: 'done', done_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', itemIds)
      .eq('status', 'pending')
    if (error) throw new ApiError(500, error.message)

    return NextResponse.json({ ok: true, doneCount: itemIds.length })
  } catch (e) {
    return jsonError(e)
  }
}

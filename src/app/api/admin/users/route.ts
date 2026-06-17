import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createClient } from '@/lib/supabase/server'
import { ApiError, jsonError } from '@/lib/api/errors'

export async function GET() {
  try {
    await requireAdmin()
    const supabase = await createClient()

    // Uses SECURITY DEFINER function — no service role key needed
    const { data, error } = await supabase.rpc('get_all_users_admin')

    if (error) throw new ApiError(500, error.message)

    const users = (data ?? []).map((row: {
      id: string; email: string; full_name: string | null;
      plan: string | null; credits: number | null;
      subscription_status: string | null;
      created_at: string; updated_at: string | null;
    }) => ({
      id: row.id,
      name: row.full_name ?? row.email?.split('@')[0] ?? '—',
      email: row.email,
      plan: row.plan ?? 'free',
      credits: row.credits ?? 0,
      status: 'active',
      subscriptionStatus: row.subscription_status ?? 'none',
      joined: new Date(row.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
      lastActive: row.updated_at
        ? new Date(row.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : '—',
    }))

    return NextResponse.json({ users })
  } catch (e) {
    return jsonError(e)
  }
}

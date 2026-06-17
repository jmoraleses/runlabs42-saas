import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { mapIntegrationStatus } from '@/lib/integrations/status'
import type { UserIntegrationRow } from '@/lib/integrations/types'

/** Inicia el flujo OAuth de Vercel (redirige a /api/integrations/vercel/connect). */
export async function POST() {
  try {
    await requireUser()
    return NextResponse.json({
      ok: true,
      redirect: '/api/integrations/vercel/connect',
    })
  } catch (e) {
    return jsonError(e)
  }
}

export async function DELETE() {
  try {
    const { supabase, user } = await requireUser()
    const { error } = await supabase
      .from('user_integrations')
      .update({
        vercel_team_id: null,
        vercel_access_token_enc: null,
        vercel_connected_at: null,
      })
      .eq('user_id', user.id)
    if (error) throw new ApiError(500, error.message)
    const { data } = await supabase.from('user_integrations').select('*').eq('user_id', user.id).maybeSingle()
    return NextResponse.json({
      ok: true,
      integrations: mapIntegrationStatus(data as UserIntegrationRow | null),
    })
  } catch (e) {
    return jsonError(e)
  }
}

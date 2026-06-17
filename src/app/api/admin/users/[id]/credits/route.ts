import { jsonError, ApiError } from '@/lib/api/errors'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createClient } from '@/lib/supabase/server'

export { dynamic } from '@/lib/api/routeSegment'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin()
    const { id } = params
    if (!id) throw new ApiError(400, 'ID de usuario requerido')

    const body = await request.json()
    const credits = Number(body.credits)
    if (!Number.isFinite(credits) || credits < 0) {
      throw new ApiError(400, 'Cantidad de créditos no válida')
    }

    // Use SECURITY DEFINER function to bypass RLS
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('admin_set_user_credits', {
      p_target_user_id: id,
      p_credits: credits,
    })

    if (error) throw new ApiError(500, error.message)
    const row = Array.isArray(data) ? data[0] : data
    return Response.json({ ok: true, user: row })
  } catch (e) {
    return jsonError(e)
  }
}

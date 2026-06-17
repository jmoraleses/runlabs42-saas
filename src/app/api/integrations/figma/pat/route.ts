import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { encryptSecret } from '@/lib/integrations/crypto'
import { fetchFigmaUserId } from '@/lib/integrations/figmaOAuth'

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const body = await request.json()
    const pat = String(body.pat ?? '').trim()
    if (!pat) throw new ApiError(400, 'Token de acceso personal requerido')

    // Validate the PAT works by calling Figma API
    let figmaUserId: string
    try {
      figmaUserId = await fetchFigmaUserId(pat)
    } catch {
      throw new ApiError(401, 'Token de Figma inválido. Verifica que tenga permisos de lectura de archivos.')
    }

    const enc = encryptSecret(pat)
    const patch = {
      figma_access_token_enc: enc,
      figma_refresh_token_enc: null,
      figma_user_id: figmaUserId,
      figma_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('user_integrations')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase.from('user_integrations').update(patch).eq('user_id', user.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('user_integrations').insert({ user_id: user.id, ...patch })
      if (error) throw error
    }

    return NextResponse.json({ ok: true, userId: figmaUserId })
  } catch (e) {
    return jsonError(e)
  }
}

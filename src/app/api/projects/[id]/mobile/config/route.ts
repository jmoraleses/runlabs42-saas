import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { mapProject } from '@/lib/db/mappers'
import { defaultMobileConfig } from '@/lib/mobile/defaults'
import type { MobileConfig } from '@/types/mobile'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    const row = await requireProjectAccess(supabase, id, user.id)
    const { data } = await supabase
      .from('projects')
      .select('name, mobile_config')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    const name = String(data?.name ?? row.name)
    const stored = (data?.mobile_config as MobileConfig | null) ?? null
    const config = stored?.appId ? stored : defaultMobileConfig(name)
    return NextResponse.json({ config })
  } catch (e) {
    return jsonError(e)
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, id, user.id)
    const body = await request.json()
    const config = body.config as MobileConfig
    if (!config?.appId || !config?.displayName) {
      throw new ApiError(400, 'mobile_config requiere appId y displayName')
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ mobile_config: config, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw new ApiError(500, error.message)
    return NextResponse.json({ project: mapProject(data), config })
  } catch (e) {
    return jsonError(e)
  }
}

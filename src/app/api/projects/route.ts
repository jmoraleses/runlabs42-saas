import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { mapProject } from '@/lib/db/mappers'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { isValidProjectFramework } from '@/lib/scaffolds/types'

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'projects:list'), 120)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const { searchParams } = new URL(request.url)
    let query = supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'deleted')
      .order('updated_at', { ascending: false })

    const framework = searchParams.get('framework')
    if (framework) query = query.eq('framework', framework)

    const status = searchParams.get('status')
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) throw new ApiError(500, 'No se pudieron cargar los proyectos')
    return NextResponse.json({ projects: (data ?? []).map(mapProject) })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'projects:create'), 30, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json()
    const name = String(body.name ?? '').trim()
    if (!name) throw new ApiError(400, 'El nombre del proyecto es obligatorio')
    if (name.length > 120) throw new ApiError(400, 'El nombre no puede superar 120 caracteres')

    const framework = String(body.framework ?? 'react').toLowerCase()
    const targetPlatforms = Array.isArray(body.targetPlatforms)
      ? body.targetPlatforms
      : ['web', 'ios', 'android']
    if (!isValidProjectFramework(framework)) {
      throw new ApiError(400, 'Framework no válido')
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        description: body.description ?? null,
        framework,
        status: 'draft',
        storage_provider: 'platform',
        target_platforms: targetPlatforms,
        mobile_config: body.mobileConfig ?? {},
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/projects] insert error:', error)
      throw new ApiError(500, 'No se pudo crear el proyecto')
    }

    const { error: specErr } = await supabase.from('specs').insert({
      project_id: data.id,
      content: body.initialSpec ?? '',
      created_by: user.id,
    })

    if (specErr) {
      console.error('[POST /api/projects] spec insert error:', specErr)
      await supabase.from('projects').delete().eq('id', data.id)
      throw new ApiError(500, 'No se pudo crear la especificación inicial')
    }

    return NextResponse.json({ project: mapProject(data) }, { status: 201 })
  } catch (e) {
    return jsonError(e)
  }
}

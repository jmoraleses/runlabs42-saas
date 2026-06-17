import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { requireProjectFilesStore } from '@/lib/storage/requireProjectFilesStore'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { runMobileReadinessScan } from '@/lib/mobile/scan'
import { mapProject } from '@/lib/db/mappers'

type Params = { params: Promise<{ id: string }> }

const SCAN_CREDIT = 1

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'mobile-scan'), 20, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    await requireProjectAccess(supabase, id, user.id)

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, name, deployed_url, framework')
      .eq('id', id)
      .single()
    if (projErr || !project) throw new ApiError(404, 'Proyecto no encontrado')

    const deployedUrl = project.deployed_url ? String(project.deployed_url) : null
    if (!deployedUrl) {
      throw new ApiError(400, 'Publica la app web antes de escanear para móvil')
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      await admin.rpc('deducir_creditos', {
        p_user_id: user.id,
        p_amount: SCAN_CREDIT,
        p_model: 'mobile-scan',
        p_tokens: 0,
        p_description: 'Mobile readiness scan',
      })
    }

    const store = requireProjectFilesStore(supabase, user.id, id)
    const fileRecords = await store.list()
    const files = fileRecords.map((f) => ({ path: f.path, content: f.content }))

    const readiness = await runMobileReadinessScan({
      deployedUrl,
      files,
      framework: project.framework ? String(project.framework) : undefined,
    })

    await supabase.from('mobile_scans').insert({
      project_id: id,
      user_id: user.id,
      score: readiness.score,
      checks: readiness.checks,
      targets: readiness.targets ?? ['ios', 'android'],
    })

    const { data: updated, error: updErr } = await supabase
      .from('projects')
      .update({ mobile_readiness: readiness, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updErr) throw new ApiError(500, updErr.message)

    return NextResponse.json({
      readiness,
      project: mapProject(updated),
    })
  } catch (e) {
    return jsonError(e)
  }
}

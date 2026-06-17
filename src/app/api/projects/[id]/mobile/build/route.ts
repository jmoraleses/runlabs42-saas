import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { put } from '@vercel/blob'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { buildCapacitorZip } from '@/lib/mobile/capacitorTemplate'
import { defaultMobileConfig } from '@/lib/mobile/defaults'
import type { MobileBuildMode, MobileConfig } from '@/types/mobile'

type Params = { params: Promise<{ id: string }> }

const BUILD_CREDIT = 4
const PRO_PLANS = new Set(['pro', 'team', 'starter'])

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'mobile-build'), 10, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    await requireProjectAccess(supabase, id, user.id)

    const { data: profile } = await supabase
      .from('users')
      .select('plan')
      .eq('id', user.id)
      .single()
    const plan = String(profile?.plan ?? 'free')
    if (!PRO_PLANS.has(plan)) {
      throw new ApiError(403, 'La descarga móvil requiere plan Starter o superior')
    }

    const body = await request.json().catch(() => ({}))
    const mode = (body.mode === 'bundled' ? 'bundled' : 'remote') as MobileBuildMode

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, name, deployed_url, mobile_config')
      .eq('id', id)
      .single()
    if (projErr || !project) throw new ApiError(404, 'Proyecto no encontrado')

    const deployedUrl = project.deployed_url ? String(project.deployed_url) : null
    if (!deployedUrl) {
      throw new ApiError(400, 'Publica la app web antes de generar el proyecto móvil')
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      const { data: ok } = await admin.rpc('deducir_creditos', {
        p_user_id: user.id,
        p_amount: BUILD_CREDIT,
        p_model: 'mobile-build',
        p_tokens: 0,
        p_description: 'Capacitor project export',
      })
      if (ok === false) throw new ApiError(402, 'Créditos insuficientes')
    }

    const stored = (project.mobile_config as MobileConfig | null) ?? null
    const mobileConfig = stored?.appId ? stored : defaultMobileConfig(String(project.name))

    const { data: buildRow, error: buildInsErr } = await supabase
      .from('mobile_builds')
      .insert({
        project_id: id,
        user_id: user.id,
        status: 'running',
        mode,
      })
      .select('id')
      .single()

    if (buildInsErr || !buildRow) throw new ApiError(500, 'No se pudo crear el job de build')

    const jobId = String(buildRow.id)

    try {
      const zipBuffer = await buildCapacitorZip({
        projectName: String(project.name),
        deployedUrl,
        mobileConfig,
        mode,
      })

      let artifactUrl: string | null = null
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const blob = await put(
          `mobile-builds/${user.id}/${id}/${jobId}.zip`,
          zipBuffer,
          { access: 'public', contentType: 'application/zip' },
        )
        artifactUrl = blob.url
      } else {
        artifactUrl = null
      }

      await supabase
        .from('mobile_builds')
        .update({
          status: 'completed',
          artifact_url: artifactUrl,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      await supabase
        .from('projects')
        .update({ last_mobile_build_at: new Date().toISOString() })
        .eq('id', id)

      return NextResponse.json({
        jobId,
        status: 'completed',
        artifactUrl,
        downloadHint: artifactUrl
          ? undefined
          : 'Configura BLOB_READ_WRITE_TOKEN para descargar el zip desde la nube.',
      })
    } catch (buildErr) {
      const msg = buildErr instanceof Error ? buildErr.message : 'Build failed'
      await supabase
        .from('mobile_builds')
        .update({ status: 'failed', error_message: msg, completed_at: new Date().toISOString() })
        .eq('id', jobId)
      throw new ApiError(500, msg)
    }
  } catch (e) {
    return jsonError(e)
  }
}

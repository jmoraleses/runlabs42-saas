import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { requireUserIntegrations } from '@/lib/integrations/requireIntegrations'
import { requireProjectFilesStore } from '@/lib/storage/requireProjectFilesStore'
import { deployProjectToVercel } from '@/lib/integrations/vercelDeploy'
import {
  fetchVercelDeploymentStatus,
  mapReadyStateToStatus,
} from '@/lib/integrations/vercelDeploymentStatus'
import {
  cancelVercelDeployment,
  deleteVercelDeployment,
} from '@/lib/integrations/vercelDeployCleanup'
import { hashProjectFiles } from '@/lib/design/filesHash'
import { hasAppSourceFiles } from '@/lib/design/types'
import type { UserIntegrationRow } from '@/lib/integrations/types'

type Params = { params: Promise<{ id: string }> }

const VERCEL_REQUIRED_MSG =
  'Conecta tu cuenta de Vercel en Ajustes → Integraciones para el preview.'

function deployableFiles(files: Array<{ path: string; content: string }>) {
  return files.filter(
    (f) =>
      !f.path.startsWith('design/variants/') &&
      f.path !== 'spec/design.md' &&
      (!f.path.startsWith('spec/design') || f.path === 'spec/design.json'),
  )
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, id, user.id)
    const body = await request.json().catch(() => ({}))
    const action = String(body.action ?? 'deploy')

    const { row } = await requireUserIntegrations(supabase, user.id)
    if (!row.vercel_access_token_enc) {
      throw new ApiError(403, VERCEL_REQUIRED_MSG)
    }

    if (action === 'cleanup') {
      const { data: rows } = await supabase
        .from('project_preview_deployments')
        .select('vercel_deployment_id, status')
        .eq('project_id', id)

      for (const r of rows ?? []) {
        if (r.status === 'building') {
          await cancelVercelDeployment(row as UserIntegrationRow, r.vercel_deployment_id).catch(
            () => {},
          )
        }
        await deleteVercelDeployment(row as UserIntegrationRow, r.vercel_deployment_id).catch(
          () => {},
        )
      }
      await supabase.from('project_preview_deployments').delete().eq('project_id', id)
      return NextResponse.json({ ok: true, cleaned: (rows ?? []).length })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, name, external_vercel_project_id, design_phase')
      .eq('id', id)
      .single()
    if (!project) throw new ApiError(404, 'Proyecto no encontrado')

    const store = requireProjectFilesStore(supabase, user.id, id)
    const allFiles = await store.list()
    const paths = allFiles.map((f) => f.path)
    if (!hasAppSourceFiles(paths) && project.design_phase !== 'code') {
      throw new ApiError(400, 'Convierte el diseño a app antes del preview Vercel')
    }

    const files = deployableFiles(allFiles.map((f) => ({ path: f.path, content: f.content })))
    if (!files.length) throw new ApiError(400, 'Sin archivos para desplegar')

    const filesHash = hashProjectFiles(files, { excludeDesign: true })

    const { data: existing } = await supabase
      .from('project_preview_deployments')
      .select('*')
      .eq('project_id', id)
      .eq('files_hash', filesHash)
      .maybeSingle()

    if (existing?.status === 'ready' && existing.preview_url) {
      return NextResponse.json({
        ok: true,
        cached: true,
        url: existing.preview_url,
        deploymentId: existing.vercel_deployment_id,
        status: 'ready',
      })
    }

    const { deploymentUrl, projectId: vercelProjectId, deploymentId } =
      await deployProjectToVercel({
        integration: row as UserIntegrationRow,
        projectName: String(project.name),
        files,
        existingProjectId: project.external_vercel_project_id
          ? String(project.external_vercel_project_id)
          : null,
        target: 'preview',
      })

    await supabase.from('project_preview_deployments').upsert(
      {
        project_id: id,
        files_hash: filesHash,
        vercel_deployment_id: deploymentId,
        vercel_project_id: vercelProjectId,
        preview_url: deploymentUrl || null,
        status: 'building',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,files_hash' },
    )

    if (!project.external_vercel_project_id) {
      await supabase
        .from('projects')
        .update({ external_vercel_project_id: vercelProjectId })
        .eq('id', id)
    }

    return NextResponse.json({
      ok: true,
      url: deploymentUrl,
      deploymentId,
      status: 'building',
      filesHash,
    })
  } catch (e) {
    return jsonError(e)
  }
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, id, user.id)

    const url = new URL(request.url)
    const filesHash = url.searchParams.get('filesHash')

    let query = supabase
      .from('project_preview_deployments')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (filesHash) query = query.eq('files_hash', filesHash)

    const { data: row } = await query.maybeSingle()
    if (!row) {
      return NextResponse.json({ status: 'idle' })
    }

    const { row: integration } = await requireUserIntegrations(supabase, user.id)
    if (!integration.vercel_access_token_enc) {
      return NextResponse.json({ status: row.status, url: row.preview_url })
    }

    if (row.status === 'building') {
      const live = await fetchVercelDeploymentStatus(
        integration as UserIntegrationRow,
        row.vercel_deployment_id,
      )
      const status = mapReadyStateToStatus(live.readyState)
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }
      if (live.url) updates.preview_url = live.url
      if (live.buildLog) updates.build_log = live.buildLog.slice(0, 120_000)
      if (live.errorMessage) updates.build_log = live.buildLog || live.errorMessage

      await supabase
        .from('project_preview_deployments')
        .update(updates)
        .eq('id', row.id)

      return NextResponse.json({
        status,
        url: live.url ?? row.preview_url,
        deploymentId: row.vercel_deployment_id,
        buildLog: live.buildLog || row.build_log,
        errorMessage: live.errorMessage,
        filesHash: row.files_hash,
      })
    }

    return NextResponse.json({
      status: row.status,
      url: row.preview_url,
      deploymentId: row.vercel_deployment_id,
      buildLog: row.build_log,
      filesHash: row.files_hash,
    })
  } catch (e) {
    return jsonError(e)
  }
}

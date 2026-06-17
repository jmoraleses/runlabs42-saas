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
import type { UserIntegrationRow } from '@/lib/integrations/types'

type Params = { params: Promise<{ id: string }> }

const VERCEL_REQUIRED_MSG =
  'Conecta tu cuenta de Vercel en Ajustes → Integraciones para desplegar.'

function deployableFiles(files: Array<{ path: string; content: string }>) {
  return files.filter(
    (f) =>
      !f.path.startsWith('design/variants/') &&
      f.path !== 'spec/design.md' &&
      (!f.path.startsWith('spec/design') || f.path === 'spec/design.json'),
  )
}

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, id, user.id)
    const { row } = await requireUserIntegrations(supabase, user.id)

    if (!row.vercel_access_token_enc) {
      throw new ApiError(403, VERCEL_REQUIRED_MSG)
    }

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, name, external_vercel_project_id')
      .eq('id', id)
      .single()
    if (projErr || !project) throw new ApiError(404, 'Proyecto no encontrado')

    const store = requireProjectFilesStore(supabase, user.id, id)
    const fileRecords = await store.list()
    const files = deployableFiles(fileRecords.map((r) => ({ path: r.path, content: r.content })))
    if (!files.length) throw new ApiError(400, 'El proyecto no tiene archivos para desplegar')

    const { deploymentUrl, projectId: vercelProjectId, deploymentId } = await deployProjectToVercel({
      integration: row as UserIntegrationRow,
      projectName: String(project.name),
      files,
      existingProjectId: project.external_vercel_project_id
        ? String(project.external_vercel_project_id)
        : null,
      target: 'production',
    })

    await supabase
      .from('projects')
      .update({
        external_vercel_project_id: vercelProjectId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      ok: true,
      url: deploymentUrl,
      deploymentId,
      vercelProjectId,
      status: 'building',
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

    const deploymentId = new URL(request.url).searchParams.get('deploymentId')
    if (!deploymentId) throw new ApiError(400, 'deploymentId es obligatorio')

    const { row: integration } = await requireUserIntegrations(supabase, user.id)
    if (!integration.vercel_access_token_enc) {
      throw new ApiError(403, VERCEL_REQUIRED_MSG)
    }

    const live = await fetchVercelDeploymentStatus(
      integration as UserIntegrationRow,
      deploymentId,
    )
    const status = mapReadyStateToStatus(live.readyState)
    const url = live.url

    if (status === 'ready' && url) {
      await supabase
        .from('projects')
        .update({
          deployed_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    }

    return NextResponse.json({
      status,
      url,
      deploymentId,
      buildLog: live.buildLog,
      errorMessage: live.errorMessage,
    })
  } catch (e) {
    return jsonError(e)
  }
}

import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireUser } from '@/lib/auth/requireUser'
import { requireProjectAccess } from '@/lib/projects/access'
import { requireUserIntegrations } from '@/lib/integrations/requireIntegrations'
import { requireProjectFilesStore } from '@/lib/storage/requireProjectFilesStore'
import { normalizeCodeTemplate } from '@/lib/codeTemplates'
import { updateProjectDesignMeta } from '@/lib/design/requireDesignRoute'
import { runPublishPipeline } from '@/lib/publish/runPublish'
import {
  fetchVercelDeploymentStatus,
  mapReadyStateToStatus,
} from '@/lib/integrations/vercelDeploymentStatus'
import type { UserIntegrationRow } from '@/lib/integrations/types'

type Params = { params: Promise<{ id: string }> }

const VERCEL_REQUIRED_MSG =
  'Conecta tu cuenta de Vercel en Ajustes → Integraciones para publicar.'

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, projectId, user.id)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'publish'), 4, 120_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json().catch(() => ({}))
    const { row } = await requireUserIntegrations(supabase, user.id)
    if (!row.vercel_access_token_enc) {
      throw new ApiError(403, VERCEL_REQUIRED_MSG)
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, name, external_vercel_project_id, framework, code_template')
      .eq('id', projectId)
      .single()
    if (!project) throw new ApiError(404, 'Proyecto no encontrado')

    const store = requireProjectFilesStore(supabase, user.id, projectId)
    const encoder = new TextEncoder()
    let vercelProjectId = project.external_vercel_project_id
      ? String(project.external_vercel_project_id)
      : null

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }
        try {
          const codeTemplate = normalizeCodeTemplate(
            body.codeTemplate ?? (project.code_template as string | null),
          )
          const result = await runPublishPipeline({
            store,
            integration: row as UserIntegrationRow,
            projectName: String(project.name),
            framework: String(body.framework ?? project.framework ?? 'next'),
            codeTemplate,
            modelId: body.model ? String(body.model) : undefined,
            existingVercelProjectId: vercelProjectId,
            postgresUrl: body.postgresUrl ? String(body.postgresUrl) : undefined,
            resendApiKey: body.resendApiKey ? String(body.resendApiKey) : undefined,
            contactToEmail: body.contactToEmail ? String(body.contactToEmail) : undefined,
            onEvent: (event) => {
              send(event as Record<string, unknown>)
            },
          })

          if (result.vercelProjectId) {
            vercelProjectId = result.vercelProjectId
            await supabase
              .from('projects')
              .update({
                external_vercel_project_id: result.vercelProjectId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', projectId)
          }

          await updateProjectDesignMeta(
            { supabase, user, store, mode: 'db' },
            projectId,
            { designPhase: 'code', codeTemplate },
          )

          send({ phase: 'done', url: result.url, deploymentId: result.deploymentId })
        } catch (e) {
          send({
            phase: 'error',
            message: e instanceof Error ? e.message : 'Error al publicar',
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, projectId, user.id)

    const deploymentId = new URL(request.url).searchParams.get('deploymentId')
    if (!deploymentId) throw new ApiError(400, 'deploymentId es obligatorio')

    const { row } = await requireUserIntegrations(supabase, user.id)
    if (!row.vercel_access_token_enc) {
      throw new ApiError(403, VERCEL_REQUIRED_MSG)
    }

    const live = await fetchVercelDeploymentStatus(row as UserIntegrationRow, deploymentId)
    const status = mapReadyStateToStatus(live.readyState)
    return NextResponse.json({
      status,
      url: live.url,
      buildLog: live.buildLog,
      errorMessage: live.errorMessage,
    })
  } catch (e) {
    return jsonError(e)
  }
}

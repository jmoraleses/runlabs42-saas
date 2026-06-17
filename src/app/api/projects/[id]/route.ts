import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { cookies } from 'next/headers'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { isDemoProjectId } from '@/lib/auth/demo-server'
import { isDemoCookieValue, isDemoStreamAllowed } from '@/lib/auth/demo-stream'
import { mapProject } from '@/lib/db/mappers'
import { requireProjectAccess } from '@/lib/projects/access'
import { deleteProjectCompletely } from '@/lib/projects/deleteProjectCompletely'
import { isDemoFilesystemBackend } from '@/lib/storage/demoProjectFilesStore'
import { z } from 'zod'
import { ALL_PROJECT_FRAMEWORKS } from '@/lib/scaffolds/types'
import { CODE_TEMPLATES } from '@/lib/codeTemplates'

const VALID_FRAMEWORKS = ALL_PROJECT_FRAMEWORKS
const VALID_CODE_TEMPLATES = CODE_TEMPLATES
const VALID_STATUSES = ['draft', 'published', 'archived'] as const

const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  framework: z.enum(VALID_FRAMEWORKS).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  targetPlatforms: z.array(z.string().max(32)).max(5).optional(),
  mobileConfig: z.record(z.unknown()).optional(),
  mobileReadiness: z.record(z.unknown()).optional(),
  deployedUrl: z.string().url().max(512).nullable().optional(),
  codeTemplate: z.enum(VALID_CODE_TEMPLATES).optional(),
  codeTemplateLinkParamMap: z
    .record(z.string(), z.record(z.string(), z.string().min(1).max(80)))
    .optional(),
})

type Params = { params: Promise<{ id: string }> }

async function allowDemoProjectApi(projectId: string): Promise<boolean> {
  if (!isDemoProjectId(projectId)) return false
  if (isDemoFilesystemBackend()) return true
  const demoCookie = isDemoCookieValue((await cookies()).get('runlabs_demo')?.value)
  return !!(demoCookie && isDemoStreamAllowed())
}

function demoProjectResponse(projectId: string) {
  const now = new Date().toISOString()
  return {
    project: mapProject({
      id: projectId,
      user_id: 'demo-user',
      name: 'Proyecto demo',
      description: null,
      framework: 'react',
      status: 'draft',
      public: false,
      target_platforms: ['web'],
      mobile_config: null,
      mobile_readiness: null,
      deployed_url: null,
      cover_url: null,
      design_phase: 'design',
      design_approved_at: null,
      code_template: 'html',
      created_at: now,
      updated_at: now,
    }),
  }
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    if (await allowDemoProjectApi(id)) {
      return NextResponse.json(demoProjectResponse(id))
    }

    const { supabase, user } = await requireUser()

    await requireProjectAccess(supabase, id, user.id)

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .neq('status', 'deleted')
      .single()

    if (error || !data) throw new ApiError(404, 'Proyecto no encontrado')
    return NextResponse.json({ project: mapProject(data) })
  } catch (e) {
    return jsonError(e)
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    const rawBody = await request.json()

    const parsed = projectUpdateSchema.safeParse(rawBody)
    if (!parsed.success) {
      throw new ApiError(400, 'Datos de proyecto inválidos', parsed.error.flatten() as Record<string, unknown>)
    }

    const body = parsed.data
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name != null) updates.name = body.name
    if (body.description != null) updates.description = body.description
    if (body.framework != null) updates.framework = body.framework
    if (body.status != null) updates.status = body.status
    if (body.targetPlatforms != null) updates.target_platforms = body.targetPlatforms
    if (body.mobileConfig != null) updates.mobile_config = body.mobileConfig
    if (body.mobileReadiness != null) updates.mobile_readiness = body.mobileReadiness
    if (body.deployedUrl != null) updates.deployed_url = body.deployedUrl
    if (body.codeTemplate != null) updates.code_template = body.codeTemplate
    if (body.codeTemplateLinkParamMap != null) {
      updates.code_template_link_param_map = body.codeTemplateLinkParamMap
    }

    await requireProjectAccess(supabase, id, user.id)

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .neq('status', 'deleted')
      .select()
      .single()

    if (error || !data) throw new ApiError(404, 'Proyecto no encontrado')
    return NextResponse.json({ project: mapProject(data) })
  } catch (e) {
    return jsonError(e)
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()

    await deleteProjectCompletely(supabase, user.id, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

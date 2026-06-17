import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { runLighthousePwaAudit } from '@/lib/mobile/lighthouseAudit'

type Params = { params: Promise<{ id: string }> }

/** Fase 3: auditoría PWA (stub; integrar Lighthouse CI en producción). */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, id, user.id)

    const { data: project } = await supabase
      .from('projects')
      .select('deployed_url')
      .eq('id', id)
      .single()

    const url = project?.deployed_url ? String(project.deployed_url) : null
    if (!url) throw new ApiError(400, 'Publica la app web antes de la auditoría Lighthouse')

    const result = await runLighthousePwaAudit(url)
    return NextResponse.json(result)
  } catch (e) {
    return jsonError(e)
  }
}

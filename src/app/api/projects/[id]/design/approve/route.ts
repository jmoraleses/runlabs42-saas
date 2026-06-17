import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { findDesignEntry } from '@/lib/design/previewServe'
import { requireDesignRouteContext, updateProjectDesignMeta } from '@/lib/design/requireDesignRoute'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    await requireStreamUser()

    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    if (!findDesignEntry(files)) {
      throw new ApiError(400, 'Genera un mockup antes de aprobar el diseño')
    }

    const approvedAt = new Date().toISOString()
    await updateProjectDesignMeta(ctx, projectId, {
      designApprovedAt: approvedAt,
      designPhase: 'design',
    })

    return NextResponse.json({ ok: true, designApprovedAt: approvedAt })
  } catch (e) {
    return jsonError(e)
  }
}

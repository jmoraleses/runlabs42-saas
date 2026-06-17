import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { deleteStitchProject, normalizeStitchProjectId } from '@/lib/design/stitchMcpClient'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    await requireStreamUser()
    const { projectId } = await params
    const normalizedProjectId = normalizeStitchProjectId(String(projectId ?? '').trim())
    if (!normalizedProjectId) throw new ApiError(400, 'projectId requerido')
    await deleteStitchProject(normalizedProjectId)
    return NextResponse.json({ ok: true, projectId: normalizedProjectId })
  } catch (e) {
    return jsonError(e)
  }
}

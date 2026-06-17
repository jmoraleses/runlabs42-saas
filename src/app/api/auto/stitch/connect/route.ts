import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { connectStitch } from '@/lib/auto/stitch/connectStitch'

export async function POST(request: Request) {
  try {
    await requireStreamUser()
    const body = await request.json().catch(() => ({}))
    const validateProjectId = String(body.projectId ?? body.stitchProjectId ?? '').trim() || undefined
    const createTestProject = body.createTestProject === true

    const result = await connectStitch({ validateProjectId, createTestProject })
    return NextResponse.json(result)
  } catch (e) {
    return jsonError(e)
  }
}

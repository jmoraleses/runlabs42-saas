import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { ApiError, jsonError } from '@/lib/api/errors'
import { isStitchNavigationAbortError } from '@/lib/auto/stitch/stitchPlaywright.shared'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { listStitchProjectsViaPlaywright } from '@/lib/auto/stitch/listStitchProjectsViaPlaywright'

export async function GET(request: Request) {
  try {
    await requireStreamUser()
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') ?? 500) || 500
    const projects = await listStitchProjectsViaPlaywright(limit)
    return NextResponse.json({ projects, mode: 'playwright' })
  } catch (e) {
    if (isStitchNavigationAbortError(e)) {
      return jsonError(
        new ApiError(
          502,
          'Stitch interrumpió la navegación (ERR_ABORTED). Cierra otras ventanas de Chrome con el perfil de stitch:auth y pulsa Recargar.',
        ),
      )
    }
    return jsonError(e)
  }
}

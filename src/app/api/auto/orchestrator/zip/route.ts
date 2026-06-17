import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { listStitchZipInputs } from '@/lib/auto/orchestrator/stitchZipPaths'
import { processStitchZipInput } from '@/lib/auto/orchestrator/processStitchZipInput'
import { getOrchestratorPlatform } from '@/lib/auto/orchestrator/platforms'

export async function GET() {
  try {
    await requireStreamUser()
    const out = await listStitchZipInputs()
    return NextResponse.json({
      ok: true,
      roots: out.roots,
      files: out.files,
    })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(request: Request) {
  try {
    await requireStreamUser()
    const body = (await request.json().catch(() => ({}))) as {
      platformId?: unknown
      zipFileName?: unknown
    }
    const platformId = String(body.platformId ?? '').trim()
    const zipFileName = String(body.zipFileName ?? '').trim()
    if (!platformId) throw new ApiError(400, 'platformId requerido')
    if (!zipFileName) throw new ApiError(400, 'zipFileName requerido')
    if (!getOrchestratorPlatform(platformId)) throw new ApiError(400, 'platformId no soportado')
    const result = await processStitchZipInput({
      platformId: platformId as never,
      zipFileName,
    })
    return NextResponse.json({
      ok: true,
      result,
    })
  } catch (e) {
    return jsonError(e)
  }
}

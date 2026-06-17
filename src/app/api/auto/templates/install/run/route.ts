import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
export const runtime = 'nodejs'

import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { runTemplateStackInstallers } from '@/lib/auto/templates/runTemplateStackInstallers'

export async function POST(request: Request) {
  try {
    await requireStreamUser()
    const body = (await request.json().catch(() => ({}))) as {
      stackIds?: unknown[]
      includeManual?: unknown
      includeCloud?: unknown
    }
    const stackIds = Array.isArray(body.stackIds)
      ? body.stackIds.map((x) => String(x).trim()).filter(Boolean)
      : undefined
    const includeManual = body.includeManual === true
    const includeCloud = body.includeCloud === true
    const workspaceRoot = process.cwd()
    const out = await runTemplateStackInstallers(workspaceRoot, {
      stackIds,
      includeManual,
      includeCloud,
    })
    return NextResponse.json({
      ok: true,
      ...out,
    })
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return jsonError(new ApiError(400, 'Primero prepara los instaladores con el boton de 1 click'))
    }
    return jsonError(e)
  }
}

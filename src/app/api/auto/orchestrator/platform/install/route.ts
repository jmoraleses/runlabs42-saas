import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { setupTemplateStacks } from '@/lib/auto/templates/setupTemplateStacks'
import { runTemplateStackInstallers } from '@/lib/auto/templates/runTemplateStackInstallers'
import { getOrchestratorPlatform } from '@/lib/auto/orchestrator/platforms'
import { loadTemplateProductSeed } from '@/lib/auto/orchestrator/templateProductSeed'
import { runPlatformSeed } from '@/lib/auto/orchestrator/platformSeed'


export async function POST(request: Request) {
  try {
    await requireStreamUser()
    const workspaceRoot = process.cwd()
    const body = (await request.json().catch(() => ({}))) as {
      platformId?: unknown
    }
    const platformId = String(body.platformId ?? '').trim()
    if (!platformId) throw new ApiError(400, 'platformId requerido')
    const platform = getOrchestratorPlatform(platformId)
    if (!platform) throw new ApiError(400, 'platformId no soportado')

    await setupTemplateStacks(workspaceRoot)
    const run = await runTemplateStackInstallers(workspaceRoot, {
      stackIds: [platform.installStackId],
      includeCloud: false,
      includeManual: false,
    })
    const first = run.results[0] ?? null
    const templateSeed = await loadTemplateProductSeed(workspaceRoot)
    const seed = await runPlatformSeed(
      platform.id,
      workspaceRoot,
      templateSeed.products,
      templateSeed.source,
    )
    return NextResponse.json({
      ok: Boolean(first?.ok),
      platformId: platform.id,
      seedMessage: seed.message,
      seedDetails: seed.details,
      templateProductSource: templateSeed.source,
      templateProductsDetected: templateSeed.products.map((p) => p.title),
      runLogPath: run.runLogPath,
      result: first,
    })
  } catch (e) {
    return jsonError(e)
  }
}

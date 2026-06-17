import { jsonError, ApiError } from '@/lib/api/errors'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import {
  deployCloudOrchestrator,
  getCloudOrchestratorStatus,
  undeployCloudOrchestrator,
} from '@/lib/design/agentStudio/cloudOrchestratorOps.server'
import {
  saveDesignCloudOrchestratorSetting,
} from '@/lib/platform/designCloudOrchestratorSetting.server'
import { hasDesignAgentStudioEngineConfigured } from '@/lib/design/agentStudio/config.server'

export { dynamic } from '@/lib/api/routeSegment'

export const maxDuration = 300

export async function GET() {
  try {
    await requireAdmin()
    const status = await getCloudOrchestratorStatus()
    return Response.json(status)
  } catch (e) {
    return jsonError(e)
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { enabled } = body as { enabled?: boolean }
    if (typeof enabled !== 'boolean') {
      throw new ApiError(400, 'enabled (boolean) requerido')
    }
    if (enabled && !(await hasDesignAgentStudioEngineConfigured())) {
      throw new ApiError(
        400,
        'Despliega el orquestador en Google Cloud antes de activarlo.',
      )
    }
    const setting = await saveDesignCloudOrchestratorSetting({ enabled })
    return Response.json({ ok: true, setting })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST() {
  try {
    await requireAdmin()
    const result = await deployCloudOrchestrator()
    return Response.json({
      ok: true,
      engineResource: result.engineResource,
      setting: result.setting,
    })
  } catch (e) {
    return jsonError(e)
  }
}

export async function DELETE() {
  try {
    await requireAdmin()
    await undeployCloudOrchestrator()
    return Response.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

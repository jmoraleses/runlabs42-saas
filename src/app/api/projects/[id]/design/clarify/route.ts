import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { isGeminiEnabled, resolveDesignGenerateModelId } from '@/lib/ai/config.server'
import { requireDesignRouteContext } from '@/lib/design/requireDesignRoute'
import { runDesignClarify } from '@/lib/design/runDesignClarify'
import { listAdminSettings } from '@/lib/platform/adminSettings.server'
import {
  DESIGN_CLARIFY_QUESTIONS_SETTING_KEY,
  parseDesignClarifyQuestionsEnabled,
} from '@/lib/platform/designClarifyQuestionsSetting'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-clarify'), 12, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    await requireDesignRouteContext(projectId)

    const body = await request.json()
    const prompt = String(body.prompt ?? '').trim()
    if (!prompt) throw new ApiError(400, 'El prompt es obligatorio')

    if (!isGeminiEnabled()) {
      return NextResponse.json({ questions: [] })
    }
    const settings = await listAdminSettings()
    const enabled = parseDesignClarifyQuestionsEnabled(
      settings[DESIGN_CLARIFY_QUESTIONS_SETTING_KEY],
    )
    if (!enabled) {
      return NextResponse.json({ questions: [] })
    }

    const modelId = resolveDesignGenerateModelId(String(body.model ?? 'auto'))
    const skipHeuristic = Boolean(body.skipHeuristic)

    const result = await runDesignClarify({
      prompt,
      modelId,
      skipHeuristic,
    })

    return NextResponse.json(result)
  } catch (e) {
    return jsonError(e)
  }
}

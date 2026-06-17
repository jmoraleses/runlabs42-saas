import 'server-only'

import type { DesignBrief } from '@/lib/design/designBrief'
import type { DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import type { VisualBriefInference } from '@/lib/design/visualBriefInference'
import { getVertexAICredentials } from '@/lib/ai/config.server'
import { getVertexBearerToken } from '@/lib/ai/vertexAgentPlatform'
import { getDesignAgentStudioEngineResource } from '@/lib/design/agentStudio/config.server'

export type AgentOrchestrationEvent = {
  type: string
  data: string
}

export type AgentOrchestrationResult = {
  events: AgentOrchestrationEvent[]
  tokensJson: string
  layoutJson: string
  assetPlanJson: string
  modelId: string
  device: DesignPreviewBreakpoint
}

function extractPayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {}
  const root = body as Record<string, unknown>

  const unwrap = (v: unknown): Record<string, unknown> | null => {
    if (!v || typeof v !== 'object') return null
    return v as Record<string, unknown>
  }

  const output = unwrap(root.output) ?? unwrap(root.result) ?? root
  if (typeof output.text === 'string') {
    try {
      const parsed = JSON.parse(output.text) as Record<string, unknown>
      return parsed
    } catch {
      return output
    }
  }
  return output
}

/** Invoca run_orchestration en el Agent Engine desplegado. */
export async function runDesignAgentOrchestration(input: {
  brief: DesignBrief
  modelId?: string
  device?: DesignPreviewBreakpoint
  /** Auditoría visual ya hecha en Node (layoutTopology, sectionTypes…). */
  visualProfile?: VisualBriefInference
}): Promise<AgentOrchestrationResult> {
  const resource = await getDesignAgentStudioEngineResource()
  if (!resource) {
    throw new Error(
      'Agent Studio no configurado. Define DESIGN_AGENT_STUDIO_ENGINE o VERTEX_DESIGN_REASONING_ENGINE.',
    )
  }

  const creds = getVertexAICredentials()
  if (!creds) {
    throw new Error('Vertex AI no configurado para Agent Studio.')
  }

  const token = await getVertexBearerToken()
  const url = `https://${creds.location}-aiplatform.googleapis.com/v1/${resource}:query`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      class_method: 'run_orchestration',
      input: {
        brief: {
          prompt: input.brief.prompt,
          siteType: input.brief.siteType,
          brandTone: input.brief.brandTone,
          businessModel: input.brief.businessModel,
          requiredSections: input.brief.requiredSections,
          ...(input.visualProfile
            ? {
                layoutTopology: input.visualProfile.layoutTopology,
                sectionTypes: input.visualProfile.sectionTypes,
                dominantColors: input.visualProfile.dominantColors,
                colorRoles: input.visualProfile.colorRoles,
                brandName: input.visualProfile.brandName,
              }
            : {}),
        },
        model_id: input.modelId,
        device: input.device ?? 'desktop',
      },
    }),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(
      `Agent Studio run_orchestration failed (${res.status}): ${raw.slice(0, 500) || res.statusText}`,
    )
  }

  let parsed: unknown = raw
  try {
    parsed = JSON.parse(raw)
  } catch {
    /* texto plano */
  }

  const payload = extractPayload(parsed)
  const eventsRaw = payload.events
  const events: AgentOrchestrationEvent[] = Array.isArray(eventsRaw)
    ? eventsRaw
        .filter((e): e is Record<string, unknown> => Boolean(e && typeof e === 'object'))
        .map((e) => ({
          type: String(e.type ?? ''),
          data: String(e.data ?? ''),
        }))
        .filter((e) => e.type)
    : []

  const tokensJson = String(payload.tokens_json ?? '')
  const layoutJson = String(payload.layout_json ?? '')
  const assetPlanJson = String(payload.asset_plan_json ?? '')

  if (!tokensJson.trim() || !layoutJson.trim()) {
    throw new Error('Agent Studio devolvió tokens o layout vacíos.')
  }

  return {
    events,
    tokensJson,
    layoutJson,
    assetPlanJson: assetPlanJson || '{"assets":[]}',
    modelId: String(payload.model_id ?? input.modelId ?? 'gemini-3.1-flash-lite'),
    device: (input.device ?? 'desktop') as DesignPreviewBreakpoint,
  }
}

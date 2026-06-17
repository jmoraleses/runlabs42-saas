import 'server-only'

import { getVertexAICredentials } from '@/lib/ai/config.server'
import { getVertexBearerToken } from '@/lib/ai/vertexAgentPlatform'
import { getDesignAgentStudioEngineResource } from '@/lib/design/agentStudio/config.server'

export type DesignAgentStudioPhase =
  | 'visual-identity'
  | 'layout-planning'
  | 'asset-planning'
  | 'content-generation'

export type DesignAgentStudioTextOpts = {
  systemInstruction: string
  modelId?: string
  responseMimeType?: string
  phase?: DesignAgentStudioPhase
}

function extractTextFromReasoningEngineResponse(body: unknown): string {
  if (typeof body === 'string') return body
  if (!body || typeof body !== 'object') return ''

  const root = body as Record<string, unknown>
  if (typeof root.text === 'string') return root.text
  if (typeof root.output === 'string') return root.output

  const output = root.output
  if (output && typeof output === 'object') {
    const out = output as Record<string, unknown>
    if (typeof out.text === 'string') return out.text
    if (typeof out.content === 'string') return out.content
  }

  const result = root.result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (typeof r.text === 'string') return r.text
  }

  return JSON.stringify(body)
}

/** Invoca el agente desplegado en Vertex Agent Engine (Agent Studio). */
export async function queryDesignAgentStudioText(
  prompt: string,
  opts: DesignAgentStudioTextOpts,
): Promise<string> {
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
      class_method: 'query',
      input: {
        phase: opts.phase ?? 'text',
        prompt,
        system_instruction: opts.systemInstruction,
        response_mime_type: opts.responseMimeType,
        model_id: opts.modelId,
      },
    }),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(
      `Agent Studio query failed (${res.status}): ${raw.slice(0, 500) || res.statusText}`,
    )
  }

  let parsed: unknown = raw
  try {
    parsed = JSON.parse(raw)
  } catch {
    /* texto plano */
  }

  const text = extractTextFromReasoningEngineResponse(parsed)
  if (!text.trim()) {
    throw new Error('Agent Studio devolvió una respuesta vacía.')
  }
  return text
}

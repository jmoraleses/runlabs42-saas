import { DEFAULT_GEMINI_MODEL } from '@/lib/ai/constants'
import { generateAgentPlatformText, getVertexBearerToken } from '@/lib/ai/vertexAgentPlatform'

export { getVertexBearerToken }

/** Generación síncrona vía Vertex AI Agent Platform (cualquier publisher). */
export async function generateVertexText(
  prompt: string,
  opts?: {
    model?: string
    systemInstruction?: string
    maxOutputTokens?: number
    temperature?: number
    /** Mejorar prompt, memoria, etc.: prioriza Vertex Batch API si está activa en admin. */
    preferBatch?: boolean
  },
): Promise<string> {
  return generateAgentPlatformText(prompt, {
    model: opts?.model ?? DEFAULT_GEMINI_MODEL,
    systemInstruction: opts?.systemInstruction,
    maxOutputTokens: opts?.maxOutputTokens,
    temperature: opts?.temperature,
    preferBatch: opts?.preferBatch,
  })
}

import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { isGeminiEnabled } from '@/lib/ai/config.server'
import { pickCategoryModelForImprove } from '@/lib/ai/resolveCategoryStreamModel'
import { generateVertexText } from '@/lib/ai/serverCredentials'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You are a prompt engineering assistant for a web-app builder AI.
The user provides a rough draft prompt describing a web app they want to build.
Your task: rewrite it to be clearer, more specific, and better structured so the AI can generate excellent results.
Rules:
- Keep the same intent and features
- Add missing technical details when obvious (e.g. responsive, clean UI)
- Use concise, direct language
- Do NOT add explanations, notes, or meta-commentary
- Return ONLY the improved prompt text, nothing else`

export async function POST(request: Request) {
  try {
    await requireStreamUser()

    const body = await request.json()
    const prompt = String(body.prompt ?? '').trim()
    if (!prompt) throw new ApiError(400, 'El prompt no puede estar vacío')

    const modelChoice = String(body.model ?? 'auto')
    const rawCategoryModels =
      body.categoryModels && typeof body.categoryModels === 'object'
        ? (body.categoryModels as Record<string, unknown>)
        : undefined
    const categoryModels = rawCategoryModels
      ? {
          code: String(rawCategoryModels.code ?? rawCategoryModels.text ?? '').trim(),
          image: String(rawCategoryModels.image ?? '').trim(),
        }
      : undefined

    if (!isGeminiEnabled()) {
      return Response.json({ improved: prompt })
    }

    const modelId = pickCategoryModelForImprove(modelChoice, categoryModels, true)
    const improved = await generateVertexText(prompt, {
      model: modelId,
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.4,
      maxOutputTokens: 8192,
      preferBatch: true,
    })

    return Response.json({ improved: improved || prompt })
  } catch (e) {
    return jsonError(e)
  }
}

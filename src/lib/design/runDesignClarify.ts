import 'server-only'

import { generateVertexText } from '@/lib/ai/serverCredentials'
import {
  MAX_DESIGN_CLARIFY_QUESTIONS,
  parseDesignClarifyJson,
  shouldSkipDesignClarifyHeuristic,
  type DesignClarifyResult,
} from '@/lib/design/designClarify'

const CLARIFY_SYSTEM = `You help clarify requirements before generating a web app UI mockup.
The user wrote a short product description. Decide if you need clarifying questions.

Rules:
- If the prompt is already very specific (features, pages, audience, style are clear), return {"questions":[]}.
- Otherwise return 1 to ${MAX_DESIGN_CLARIFY_QUESTIONS} questions as JSON only (no markdown outside JSON).
- Match the user's language (Spanish if they wrote in Spanish, English if in English).
- Each question must have a clear "question" string and 3-6 "options" with short "id" and "label".
- Prefer concrete product/UX questions: main features, target users, pages, auth/admin, visual tone, integrations.
- Use "allowMultiple": true when several options can apply together.
- Do NOT ask about code stack, hosting, or implementation details.
- Avoid yes/no-only questions; options should be actionable choices.

JSON schema:
{
  "questions": [
    {
      "id": "features",
      "question": "...",
      "allowMultiple": true,
      "options": [
        { "id": "search", "label": "..." }
      ]
    }
  ]
}`

export async function runDesignClarify(params: {
  prompt: string
  modelId: string
  skipHeuristic?: boolean
}): Promise<DesignClarifyResult> {
  const prompt = params.prompt.trim()
  if (!prompt) return { questions: [] }

  if (!params.skipHeuristic && shouldSkipDesignClarifyHeuristic(prompt)) {
    return { questions: [] }
  }

  const userMessage = `User request for a web app design:\n\n${prompt}`

  const raw = await generateVertexText(userMessage, {
    model: params.modelId,
    systemInstruction: CLARIFY_SYSTEM,
    temperature: 0.35,
    maxOutputTokens: 4096,
    preferBatch: true,
  })

  return parseDesignClarifyJson(raw || '')
}

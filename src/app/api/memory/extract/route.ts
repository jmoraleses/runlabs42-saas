import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireMemoryUser } from '@/lib/auth/requireMemoryUser'
import { insertLocalMemories } from '@/lib/studio/localMemoryStore'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { CHAT_AUX_MODEL } from '@/lib/ai/chatInsight.shared'
import {
  getGeminiApiKey,
  getVertexAICredentials,
  isGeminiEnabled,
} from '@/lib/ai/config.server'
import { generateAgentPlatformText } from '@/lib/ai/vertexAgentPlatform'

const EXTRACT_MODEL = CHAT_AUX_MODEL
const MAX_EXTRACT_CHARS = 6000

type ExtractBody = {
  projectId?: string
  userMessage?: string
  assistantMessage?: string
}

function parseMemoriesJson(text: string): { user: string[]; project: string[] } {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { user: [], project: [] }
  try {
    const parsed = JSON.parse(match[0]) as {
      userMemories?: string[]
      projectMemories?: string[]
    }
    return {
      user: (parsed.userMemories ?? []).filter((s) => typeof s === 'string' && s.trim()),
      project: (parsed.projectMemories ?? []).filter((s) => typeof s === 'string' && s.trim()),
    }
  } catch {
    return { user: [], project: [] }
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractBody
    const projectId = body.projectId ? String(body.projectId) : ''
    const auth = await requireMemoryUser(projectId || null)
    if (auth.kind === 'demo') {
      return NextResponse.json({ ok: true, skipped: true })
    }
    const persistLocal = auth.kind === 'local'
    const supabase = auth.kind === 'user' ? auth.supabase : null
    const userId = auth.kind === 'user' ? auth.user.id : null

    if (!isGeminiEnabled()) {
      return NextResponse.json({ ok: true, skipped: true })
    }
    const userMessage = String(body.userMessage ?? '').slice(0, MAX_EXTRACT_CHARS)
    const assistantMessage = String(body.assistantMessage ?? '').slice(0, MAX_EXTRACT_CHARS)
    if (!userMessage.trim() && !assistantMessage.trim()) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    if (!persistLocal && projectId && supabase && userId) {
      await requireProjectAccess(supabase, projectId, userId)
    }

    const prompt = `Analiza este intercambio del editor Runlabs42 y extrae hechos útiles para memoria futura.
Responde SOLO con JSON válido: {"userMemories":["..."],"projectMemories":["..."]}
- userMemories: preferencias del usuario (idioma, estilo, stack) reutilizables en otros proyectos (máx 3, frases cortas).
- projectMemories: decisiones de ESTE proyecto (nombres, features, restricciones) (máx 3, frases cortas).
Si no hay nada nuevo, devuelve arrays vacíos.

Usuario:
${userMessage}

Asistente:
${assistantMessage}`

    const vertex = getVertexAICredentials()
    const apiKey = getGeminiApiKey()
    let text = ''

    if (vertex) {
      text = await generateAgentPlatformText(prompt, {
        model: EXTRACT_MODEL,
        temperature: 0.2,
      })
    } else if (apiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EXTRACT_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
        },
      )
      if (!res.ok) throw new ApiError(502, 'Extracción de memoria falló')
      const data = await res.json()
      text =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
        ''
    } else {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { user: userMems, project: projectMems } = parseMemoriesJson(text)

    if (persistLocal) {
      await insertLocalMemories(
        'user',
        null,
        userMems.slice(0, 3).map((content) => ({ category: 'auto', content })),
      )
      if (projectId) {
        await insertLocalMemories(
          'project',
          projectId,
          projectMems.slice(0, 3).map((content) => ({ category: 'auto', content })),
        )
      }
    } else if (supabase && userId) {
      for (const content of userMems.slice(0, 3)) {
        await supabase.from('user_memories').insert({
          user_id: userId,
          category: 'auto',
          content: content.slice(0, 500),
          source_project_id: projectId || null,
        })
      }

      if (projectId && !projectId.startsWith('demo-')) {
        for (const content of projectMems.slice(0, 3)) {
          await supabase.from('project_memories').insert({
            user_id: userId,
            project_id: projectId,
            category: 'auto',
            content: content.slice(0, 500),
          })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

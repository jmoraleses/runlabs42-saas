/**
 * Insights de chat vía Vertex Agent Platform — solo servidor (API routes).
 */

import { generateAgentPlatformText } from '@/lib/ai/vertexAgentPlatform'
import {
  CHAT_AUX_MODEL,
  detectLanguageHint,
  heuristicInsight,
  parseInsightJson,
  type BuildChatInsightInput,
  type ChatInsightPayload,
} from '@/lib/ai/chatInsight.shared'

export { CHAT_AUX_MODEL }

export async function buildChatInsight(input: BuildChatInsightInput): Promise<ChatInsightPayload> {
  const fallback = heuristicInsight({
    prompt: input.prompt,
    framework: input.framework,
    command: input.command,
  })

  const userText = input.prompt.trim()
  if (!userText) return fallback

  const lang = detectLanguageHint(userText)
  const platforms = (input.targetPlatforms ?? []).join(', ') || 'web'
  const systemInstruction = `Eres el asistente de SPEC Studio. Clasifica la intención del usuario y resume el plan en 1-2 frases claras.
Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "typology": "web"|"web-app"|"mobile-app"|"game"|"creative"|"landing"|"dashboard"|"tool"|"api"|"other",
  "suggestedFramework": "next"|"react"|"vue"|"svelte"|"astro"|"vanilla"|"canvas-app"|"canvas-game"|"p5"|"phaser"|"three",
  "summary": "string",
  "stackHint": "string corta"
}
Reglas:
- typology "creative" si pide dibujar, pintar, arte manual, pizarra.
- typology "game" si pide juego, score, enemigos, phaser.
- "creative" también para p5/three si es arte generativo o 3D visual (no app React).
- "landing" para páginas de marketing / hero.
- "dashboard" para paneles, métricas, admin.
- "mobile-app" si enfatiza app móvil o iOS/Android.
- "web" para sitios simples; "web-app" para apps React/Next interactivas.
- summary en ${lang === 'es' ? 'español' : 'inglés'}, tono profesional y conciso.
- Respeta framework actual del proyecto si encaja; si no, sugiere el más adecuado.`

  const prompt = `Proyecto: ${input.projectName ?? 'Sin nombre'}
Framework actual: ${input.framework ?? 'next'}
Plataformas objetivo: ${platforms}
Archivos en workspace: ${input.workspaceFileCount ?? 0}
Comando: ${input.command}

Prompt del usuario:
${userText}`

  try {
    const raw = await generateAgentPlatformText(prompt, {
      model: CHAT_AUX_MODEL,
      systemInstruction,
      temperature: 0.2,
    })
    const parsed = parseInsightJson(raw)
    if (parsed) {
      if (!parsed.suggestedFramework && fallback.suggestedFramework) {
        parsed.suggestedFramework = fallback.suggestedFramework
      }
      if (!parsed.stackHint && fallback.stackHint) {
        parsed.stackHint = fallback.stackHint
      }
      return parsed
    }
  } catch (e) {
    console.warn('[chatInsight] aux model failed, using heuristic:', e)
  }

  return fallback
}

export async function summarizeChatText(
  text: string,
  opts?: { maxChars?: number },
): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const maxChars = opts?.maxChars
  if (maxChars != null && trimmed.length <= maxChars) return trimmed

  const lang = detectLanguageHint(trimmed)
  const lengthHint =
    maxChars != null
      ? ` (máx. ${maxChars} caracteres)`
      : ''
  try {
    const out = await generateAgentPlatformText(
      `Resume en una sola frase clara (${lang === 'es' ? 'español' : 'inglés'}${lengthHint}):\n\n${trimmed}`,
      {
        model: CHAT_AUX_MODEL,
        systemInstruction:
          'Eres un editor conciso para mensajes de chat en un IDE. Sin markdown ni comillas.',
        temperature: 0.1,
      },
    )
    const summary = out.trim().replace(/^["']|["']$/g, '')
    if (summary) {
      return maxChars != null ? summary.slice(0, maxChars) : summary
    }
  } catch {
    /* fallback */
  }
  return maxChars != null ? trimmed.slice(0, maxChars) : trimmed
}

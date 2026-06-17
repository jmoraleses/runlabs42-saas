import type { AICommand } from '@/types'
import { parseCommand, type ParsedCommand } from '@/lib/ai/commandParser'

export type ResolvedStreamCommand = AICommand & {
  raw: string
  /** True cuando /build se eligió por intención (no comando explícito). */
  inferredBuild?: boolean
}

const PLAN_ONLY_PATTERNS = [
  /\b(expl[ií]came|explain|describe|what is|qué es|cuál es|how does|cómo funciona)\b/i,
  /\b(plan|roadmap|estrategia|strategy|arquitectura conceptual)\b/i,
  /\b(sin (código|code|implementar|tocar archivos)|without (code|implementing|changing files))\b/i,
  /\b(solo (un )?plan|only (a )?plan|just (the )?plan)\b/i,
  /\b(review|revisi[oó]n|audit|auditor[ií]a)\b/i,
  /\b(especificación|specification|acceptance criteria|criterios de aceptaci[oó]n)\b/i,
]

const BUILD_INTENT_PATTERNS = [
  /\b(crea|crear|create|genera|generar|generate|implementa|implementar|implement|build|construye|construir)\b/i,
  /\b(añade|agrega|add|insert|incorpora|include)\b/i,
  /\b(cambia|change|modifica|modify|actualiza|update|fix|arregla|corrige|mejora[rds]?|improve[ds]?)\b/i,
  /\b(diseñ[oa]|design|haz(me)?|make|desarrolla|develop)\b/i,
  /\b(elegant[ea]?s?|bonit[oa]s?|modern[ao]s?|refin[ae]|pulir|estiliza)\b/i,
  /\b(landing|página|page|sitio|website|app|aplicaci[oó]n|componente|component|formulario|form|navbar|footer|hero)\b/i,
  /\b(segunda|otra|nueva|adicional|second|another|new)\s+(p[aá]gina|page|pantalla|screen|vista|view)\b/i,
  /\b(crea|crear|create|añade|agrega|add)\s+(un\s+)?(archivo|file|fichero)\b/i,
  /\b(src\/pages|react-router|ruta|route)\b/i,
  /\b(estilos?|styles?|css|tailwind|colores?|colors?|tipograf[ií]a|font)\b/i,
  /\b(vista previa|preview|responsive|mobile|m[oó]vil)\b/i,
  /\b(s[ií]\s*,?\s*(procede|adelante)|adelante|procede|hazlo|do\s+it|vamos|continua|continúa|go\s+ahead)\b/i,
]

export type ResolveStreamCommandOptions = {
  prompt: string
  projectId?: string
  workspaceFileCount?: number
}

function isPlanOnlyMessage(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return PLAN_ONLY_PATTERNS.some((re) => re.test(t))
}

function hasBuildIntent(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (isPlanOnlyMessage(t)) return false
  return BUILD_INTENT_PATTERNS.some((re) => re.test(t))
}

/**
 * Resuelve el comando del stream: slash explícito, intención build, o plan por defecto.
 */
export function resolveStreamCommand(opts: ResolveStreamCommandOptions): ResolvedStreamCommand {
  const prompt = opts.prompt.trim()
  const explicit = parseCommand(prompt)

  if (explicit) {
    return {
      command: explicit.command,
      prompt: explicit.prompt || prompt,
      projectId: opts.projectId,
      raw: explicit.raw,
    }
  }

  const workspaceEmpty = (opts.workspaceFileCount ?? 0) === 0
  const buildByIntent = hasBuildIntent(prompt)
  const buildByEmptyWorkspace = workspaceEmpty && prompt.length > 0 && !isPlanOnlyMessage(prompt)

  if (buildByIntent || buildByEmptyWorkspace) {
    return {
      command: '/build',
      prompt,
      projectId: opts.projectId,
      raw: prompt,
      inferredBuild: true,
    }
  }

  return {
    command: '/plan',
    prompt,
    projectId: opts.projectId,
    raw: prompt,
  }
}

/** Para tests: reexportar parse explícito. */
export type { ParsedCommand }

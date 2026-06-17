import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/modelTypes'
import type { SpecKitPhase } from '@/lib/ai/spec-kit/artifacts'

export type PhasePlan = Record<SpecKitPhase, string>

const FLASH_LITE = 'gemini-2.5-flash-lite'
const FLASH = 'gemini-2.5-flash'
const PRO = 'gemini-2.5-pro'
const CLAUDE_SONNET = 'claude-sonnet-4-6'
const CLAUDE_OPUS = 'claude-opus-4-7'

const DEFAULT_PHASE_PLAN: PhasePlan = {
  constitution: FLASH_LITE,
  specify: FLASH,
  plan: FLASH,
  tasks: FLASH_LITE,
  implement: FLASH,
}

type ComplexitySignals = {
  score: number
  longPrompt: boolean
  architecture: boolean
  multiFile: boolean
  gameOr3d: boolean
  manyFeatures: boolean
}

function analyzePromptComplexity(prompt: string): ComplexitySignals {
  const lower = prompt.toLowerCase()
  const words = prompt.trim().split(/\s+/).filter(Boolean).length

  const architecture =
    /\b(arquitectura|architecture|microserv|monorepo|refactor|escalar|scale)\b/i.test(prompt)
  const multiFile =
    /\b(multi[- ]?archivo|multi[- ]?file|varios archivos|multiple files|monorepo)\b/i.test(
      prompt,
    ) || /\b\d+\s*archivos?\b/i.test(prompt)
  const gameOr3d =
    /\b(3d|three\.js|phaser|canvas|juego|game|veo|animaci[oó]n)\b/i.test(lower)
  const manyFeatures =
    (prompt.match(/\b(feature|funcionalidad|pantalla|página|page|componente|module)\b/gi) ?? [])
      .length >= 4
  const complexKeywords =
    /\b(complejo|complex|enterprise|production|avanzado|advanced|full[- ]?stack)\b/i.test(prompt)

  let score = 0
  if (words > 120) score += 2
  else if (words > 60) score += 1
  if (architecture) score += 2
  if (multiFile) score += 2
  if (gameOr3d) score += 1
  if (manyFeatures) score += 2
  if (complexKeywords) score += 2

  return {
    score,
    longPrompt: words > 80,
    architecture,
    multiFile,
    gameOr3d,
    manyFeatures,
  }
}

function planFromHeuristics(prompt: string, defaultModelId: string): PhasePlan {
  const signals = analyzePromptComplexity(prompt)
  const implementModel =
    signals.score >= 6 || (signals.architecture && signals.multiFile)
      ? CLAUDE_OPUS
      : signals.score >= 5
        ? PRO
        : signals.score >= 3
          ? FLASH
          : defaultModelId === PRO || defaultModelId === CLAUDE_OPUS
            ? defaultModelId
            : FLASH

  return {
    constitution: FLASH_LITE,
    specify: signals.longPrompt || signals.architecture ? FLASH : FLASH,
    plan: signals.architecture ? FLASH : FLASH_LITE,
    tasks: FLASH_LITE,
    implement: implementModel,
  }
}

/** Modelo principal para stream sin Spec-Kit cuando el usuario elige Max. */
export function resolveOrchestratorImplementModel(
  userPrompt: string,
  defaultModelId: string,
): string {
  return planFromHeuristics(userPrompt, defaultModelId).implement
}

/**
 * Asigna el modelo óptimo por fase del pipeline Spec-Kit.
 * Sólo debe invocarse cuando `modelChoice === 'max'`.
 */
export async function planModelsForPipeline(opts: {
  userPrompt: string
  defaultModelId: string
  geminiEnabled: boolean
  /** Modelo de la categoría Código del menú (modo custom). */
  implementModelOverride?: string
}): Promise<PhasePlan> {
  if (!opts.geminiEnabled) {
    return { ...DEFAULT_PHASE_PLAN }
  }

  const base = planFromHeuristics(opts.userPrompt, opts.defaultModelId)
  if (opts.implementModelOverride?.trim()) {
    base.implement = opts.implementModelOverride.trim()
  }

  const signals = analyzePromptComplexity(opts.userPrompt)
  if (signals.score < 7) {
    return base
  }

  // Planner LLM opcional para prompts muy complejos — por ahora heurística ampliada
  if (signals.score >= 7) {
    return {
      ...base,
      specify: CLAUDE_SONNET,
      plan: signals.architecture ? CLAUDE_SONNET : FLASH,
      implement: CLAUDE_OPUS,
    }
  }

  return base
}

export function isMaxModelChoice(choice: string | undefined | null): boolean {
  return (choice?.trim() || '').toLowerCase() === MAX_MODEL_ID
}

/** @deprecated Usar `isMaxModelChoice`. Auto ya no activa el orquestador. */
export function isAutoModelChoice(choice: string | undefined | null): boolean {
  return (choice?.trim() || AUTO_MODEL_ID).toLowerCase() === AUTO_MODEL_ID
}
